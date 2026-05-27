#!/usr/bin/env python3
"""
extract_snapshot.py  —  Oracle DBA Snapshot HTML → JSON extractor

Usage:
  python extract_snapshot.py <html_file>
      Output: <same_folder>/<stem>_data.json

  python extract_snapshot.py <folder>
      Scans folder recursively for dba_snapshot / lite_snapshot *.html files
"""
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


# ─── UNIT CONVERTERS ────────────────────────────────────────────────────────

def bytes_to_mb(val):
    """Convert a comma-formatted byte string to MB (string)."""
    try:
        return str(round(int(val.replace(',', '').strip()) / 1048576, 2))
    except Exception:
        return val


def rman_size_to_gb(val):
    return val
    """Convert human-readable RMAN size (4.74T, 985.87G, 20.90M, 512K) → GB string."""




# ─── TABLE EXTRACTION ────────────────────────────────────────────────────────

def extract_table(table):
    """Return (headers, rows) from a BeautifulSoup <table> element."""
    headers = [
        re.sub(r'\s+', ' ', th.get_text(strip=True))
        for th in table.find_all('th', {'scope': 'col'})
    ]
    rows = []
    for tr in table.find_all('tr'):
        tds = tr.find_all('td')
        if not tds:
            continue
        row = [td.get_text(strip=True) for td in tds]
        # Skip pure-separator rows (*** or --- lines)
        if all(re.match(r'^[*\-\s]*$', c) for c in row):
            continue
        rows.append(row)
    return headers, rows


# lite_snapshot uses <font size="+2"><b>Heading</b></font> instead of named anchors.
# Map every anchor name the parsers use → its equivalent heading text.
HEADING_ALIASES = {
    'tablespaces':               'Tablespaces',
    'rman_backup_jobs':          'Status RMAN Backup',
    'current_sessions':          'Current Sessions',
    'sessions_matrix_current':   'User Session Matrix',
    'sga_information':           'SGA Information',
    'file_io_statistics':        'File I/O Statistics',
    'invalid_objects':           'Invalid Objects',
    'initialization_parameters': 'Memory Initialization Parameters',
    'data_files':                'Data Files',
    'database_growth':           'Database Growth',
    'redo_log_switches':         'Redo Log Switches',
    'instance_overview':         'Instance Overview',
    'database_overview':         'Database Overview',
    'parameter_review' :         'Memory Initialization Parameters',
    'online_redo':               'Online Redo Logs',
    'performance_review':        'Performance Review',
}


def _find_section_start(soup, anchor_name):
    """Return the element after which section tables begin.
    Prefers <font size="+2"><b>Heading</b></font> falls back to the dba_snapshot
    <a name=anchor_name>;"""
    heading_text = HEADING_ALIASES.get(anchor_name, '')
    if heading_text:
        for font in soup.find_all('font', attrs={'size': '+2'}):
            b = font.find('b')
            if b and heading_text.lower() in b.get_text(strip=True).lower():
                return font
    anchor = soup.find('a', attrs={'name': anchor_name})
    if anchor:
        return anchor
    return None


def find_section_table(soup, anchor_name):
    """Return (headers, rows) of the first <table> after the named anchor.
    Falls back to heading-text lookup for lite_snapshot files."""
    start = _find_section_start(soup, anchor_name)
    if not start:
        return None, None
    table = start.find_next('table')
    if not table:
        return None, None
    return extract_table(table)


# ─── SECTION PROCESSORS ─────────────────────────────────────────────────────

def process_tablespace(soup):
    # Columns: Status | TS Name | TS Type | Ext Mgt | Seg Mgt |
    #          Tablespace Size (bytes) | Free (bytes) | Used (bytes) | Pct Used
    headers, rows = find_section_table(soup, 'tablespaces')
    if not rows:
        return None
    return {
        'tableColumns' : headers,
        'tableRows' : rows,
    }



def process_rman(soup):
    headers, rows = find_section_table(soup, 'rman_backup_jobs')
    if not rows:
        return None
    return {
        'tableColumns' : list(dict.fromkeys(headers)),
        'tableRows' : rows,
    }


def process_sessions(soup):
    headers, rows = find_section_table(soup, 'current_sessions')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows': rows,
    }

def process_sessions2(soup):
    headers, rows = find_section_table(soup, 'sessions_matrix_current')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows': rows,
    }


def process_sga(soup):
    # Columns: Instance Name | Pool Name | Bytes
    # Carry-forward instance name when cell is empty / &nbsp;
    # Skip rows where Pool is 'Total' or empty
    headers, rows = find_section_table(soup, 'sga_information')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows' : rows,
    }


def process_fileio(soup):
    # Columns: Tablespace | File Name | Physical Reads | Read Pct. |
    #          Physical Writes | Write Pct. | Total I/O
    headers, rows = find_section_table(soup, 'file_io_statistics')
    if not rows:
        return None
    return {
        'tableColumns': headers or ['Tablespace', 'File Name', 'Physical Reads', 'Read Pct.', 'Physical Writes', 'Write Pct.', 'Total I/O'],
        'tableRows': rows,
    }


def process_invalid(soup):
    headers, rows = find_section_table(soup, 'invalid_objects')
    if not rows:
        return None
    return {
        'tableColumns': headers or ['Owner', 'Object Name', 'Object Type', 'Status'],
        'tableRows': rows,
    }


def process_parameters(soup):
    # There are two tables after this anchor:
    # 1st: SPFILE usage notice (1 column, single row)
    # 2nd: actual parameters (Parameter Name | Instance Name | Value | ...)
    start = _find_section_start(soup, 'initialization_parameters')
    if not start:
        return None
    # Walk next elements to find the table with multiple columns
    param_table = None
    count = 0
    for tbl in start.find_all_next('table', limit=5):
        ths = tbl.find_all('th', {'scope': 'col'})
        if len(ths) >= 2:
            param_table = tbl
            break
        count += 1
        if count > 4:
            break
    if not param_table:
        return None
    headers, rows = extract_table(param_table)
    if not rows:
        return None
    # Keep Parameter Name and Value (cols 0 and 2), deduplicate by parameter name
    seen = set()
    out_rows = []
    for row in rows:
        if len(row) < 3:
            continue
        pname = row[0].strip()
        if not pname or pname in ('\xa0', ''):
            continue  # skip blank carry-forward instance rows
        if pname not in seen:
            seen.add(pname)
            out_rows.append([pname, row[2]])
        if len(out_rows) >= 60:
            break
    if not out_rows:
        return None
    return {
        'tableColumns': ['Parameter Name', 'Value'],
        'tableRows': out_rows,
    }


def process_datafile(soup):
    # Actual columns: Tablespace Name/File Class | Filename | File Size |
    #                 Autoextensible | Next | Max
    _, rows = find_section_table(soup, 'data_files')
    if not rows:
        return None
    out_rows = []
    for row in rows:
        if len(row) < 4:
            continue
        out_rows.append([
            row[0],               # Tablespace
            row[1],               # Filename
            bytes_to_mb(row[2]),  # Size (MB)
            row[3],               # Autoextend
        ])
    if not out_rows:
        return None
    return {
        'tableColumns': ['Tablespace', 'Filename', 'Size (MB)', 'Autoextend'],
        'tableRows': out_rows,
    }


def process_dbgrowth(soup):
    headers, rows = find_section_table(soup, 'database_growth')
    if not rows:
        return None
    out_rows = [row for row in rows if row and row[0].strip()]
    if not out_rows:
        return None
    # dba_snapshot stores raw bytes; convert to MB so output is always Megabytes
    if headers and any('byte' in h.lower() for h in headers):
        out_rows = [
            [r[0], bytes_to_mb(r[1]) if len(r) > 1 else '']
            for r in out_rows
        ]
        headers = ['Month', 'Growth (Megabytes)']
    return {'tableColumns': headers, 'tableRows': out_rows}


def process_redo(soup):
    headers, rows = find_section_table(soup, 'redo_log_switches')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows': rows,
    }


def process_dataguard(soup):
    """Build Property|Value rows from instance_overview + database_overview."""
    props = []

    _, db_rows = find_section_table(soup, 'database_overview')
    if db_rows and db_rows[0]:
        row = db_rows[0]
        if len(row) > 0:
            props.append(['Database Name', row[0]])
        if len(row) > 6:
            props.append(['Log Mode', row[6]])
        if len(row) > 7:
            open_mode = row[7]
            props.append(['Open Mode', open_mode])
            # Determine role from open mode and controlfile type
            db_role = 'PRIMARY'
            if 'WITH APPLY' in open_mode.upper():
                db_role = 'PHYSICAL STANDBY'
            elif len(row) > 10 and row[10].upper() == 'STANDBY':
                db_role = 'PHYSICAL STANDBY'
            props.append(['Database Role', db_role])
        if len(row) > 10:
            props.append(['Controlfile Type', row[10]])

    _, inst_rows = find_section_table(soup, 'instance_overview')
    if inst_rows:
        for i, row in enumerate(inst_rows):
            if len(row) > 3:
                props.append([f'Instance {i + 1}', row[0]])
                props.append([f'Host {i + 1}', row[3]])
            if len(row) > 4:
                props.append([f'Oracle Version {i + 1}', row[4]])

    if not props:
        return None
    return {'tableColumns': ['Property', 'Value'], 'tableRows': props}

def process_memoryInit(soup):
    headers, rows = find_section_table(soup, 'parameter_review')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows': rows,
    }

def process_OnlineRedo(soup):
    headers, rows = find_section_table(soup, 'online_redo')
    if not rows:
        return None
    return {
        'tableColumns': headers,
        'tableRows': rows,
    }

def process_PerformanceReview(soup):
    start = _find_section_start(soup, 'performance_review')
    if not start:
        return None
    # Find the first table after the heading
    tbl = start.find_next('table')
    if not tbl:
        return None
    # Find the next section heading after this one
    next_heading = None
    for font in start.find_all_next('font', attrs={'size': '+2'}):
        if font.find('b'):
            next_heading = font
            break
    # Reject the table if it doesn't come before the next heading
    # (next_heading must appear in tbl's subsequent elements, meaning tbl is first)
    if next_heading and next_heading not in tbl.find_all_next():
        return None
    headers, rows = extract_table(tbl)
    return {'tableColumns': headers, 'tableRows': rows} if rows else None
# ─── METADATA EXTRACTION ─────────────────────────────────────────────────────

def extract_meta(soup, html_path):
    """Extract metadata dict from instance_overview + database_overview tables,
    with fallback to the report-header key/value table used by lite_snapshot files."""
    meta = {}

    # Date from filename  (e.g. _20260212.html → 2026-02-12)
    m = re.search(r'(\d{8})', Path(html_path).stem)
    if m:
        d = m.group(1)
        meta['reportDate'] = f"{d[:4]}-{d[4:6]}-{d[6:8]}"

    # instance_overview table
    _, inst_rows = find_section_table(soup, 'instance_overview')
    if inst_rows and inst_rows[0]:
        row = inst_rows[0]
        if len(row) > 0:
            meta['instance'] = row[0]
        if len(row) > 3:
            meta['host'] = row[3]

    # database_overview table
    _, db_rows = find_section_table(soup, 'database_overview')
    if db_rows and db_rows[0]:
        row = db_rows[0]
        if len(row) > 0:
            meta['database'] = row[0]
        if len(row) > 7:
            open_mode = row[7]
            meta['openMode'] = open_mode
            db_role = 'PRIMARY'
            if 'WITH APPLY' in open_mode.upper():
                db_role = 'PHYSICAL STANDBY'
            elif len(row) > 10 and row[10].upper() == 'STANDBY':
                db_role = 'PHYSICAL STANDBY'
            meta['dbRole'] = db_role

    # Fallback: lite_snapshot report-header (plain th/td key–value pairs)
    if not meta.get('instance') or not meta.get('database'):
        for table in soup.find_all('table'):
            for tr in table.find_all('tr'):
                th = tr.find('th')
                td = tr.find('td')
                if not th or not td:
                    continue
                key = th.get_text(strip=True).lower()
                val = td.get_text(strip=True)
                if 'host name' in key:
                    meta.setdefault('host', val)
                elif 'database name' in key and 'unique' not in key:
                    meta.setdefault('database', val)
                elif 'instance name' in key:
                    meta.setdefault('instance', val)

    return meta


# ─── SECTION REGISTRY ────────────────────────────────────────────────────────

SECTION_PROCESSORS = {
    'tablespace':       process_tablespace,
    'rman':             process_rman,
    'sessions':         process_sessions,
    'sessions_matrix':  process_sessions2,
    'sgamemory':        process_sga,
    'fileio':           process_fileio,
    'invalid':          process_invalid,
    'parameters':       process_parameters,
    'datafile':         process_datafile,
    'dbgrowth':         process_dbgrowth,
    'redo':             process_redo,
    'dataguard':        process_dataguard,
    'parameter_review': process_memoryInit,
    'online_redo':      process_OnlineRedo,
    'performance_review':process_PerformanceReview,
}


# ─── MAIN EXTRACTOR ─────────────────────────────────────────────────────────

def extract_html(html_path):
    html_path = str(html_path)
    print(f"\nParsing: {html_path}")
    with open(html_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Use lxml if available, fall back to built-in html.parser
    try:
        soup = BeautifulSoup(content, 'lxml')
    except Exception:
        soup = BeautifulSoup(content, 'html.parser')

    meta = extract_meta(soup, html_path)

    sections = {}
    for sec_id, processor in SECTION_PROCESSORS.items():
        try:
            result = processor(soup)
        except Exception as exc:
            print(f"  ! {sec_id}: error — {exc}")
            result = None
        if result:
            sections[sec_id] = result
            print(f"  + {sec_id}: {len(result['tableRows'])} rows")
        else:
            print(f"  - {sec_id}: not found")

    folder_name = Path(html_path).parent.name

    output = {
        'folderName': folder_name,
        'source': Path(html_path).name,
        'meta': {
            'database':   meta.get('database', ''),
            'instance':   meta.get('instance', ''),
            'host':       meta.get('host', ''),
            'reportDate': meta.get('reportDate', ''),
            'dbRole':     meta.get('dbRole', ''),
            'openMode':   meta.get('openMode', ''),
        },
        'sections': sections,
    }

    out_path = Path(html_path).with_name(Path(html_path).stem + '_data.json')
    with open(str(out_path), 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"  >> Written: {out_path}")
    return output


def is_snapshot_html(path):
    name = path.name.lower()
    return (name.startswith('dba_snapshot') or name.startswith('lite_snapshot')) and name.endswith('.html')


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    target = Path(sys.argv[1])
    if not target.exists():
        sys.exit(f"Error: not found — {target}")

    if target.is_file():
        extract_html(target)
    else:
        found = [p for p in target.rglob('*.html') if is_snapshot_html(p)]
        if not found:
            print(f"No snapshot HTML files found in: {target}")
            sys.exit(1)
        print(f"Found {len(found)} snapshot file(s) under {target}")
        for p in found:
            try:
                extract_html(p)
            except Exception as exc:
                print(f"  ERROR processing {p}: {exc}")
        print(f"\nDone — {len(found)} file(s) processed.")


if __name__ == '__main__':
    main()
