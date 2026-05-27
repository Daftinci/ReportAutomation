FROM node:22 as base
WORKDIR /usr/local/app

###FRONTEND STAGE###

FROM base as frontend-base
COPY Frontend/Report_Automation/package.json  Frontend/Report_Automation/package-lock.json ./
RUN npm install
COPY Frontend/Report_Automation/eslint.config.js Frontend/Report_Automation/index.html ./
COPY Frontend/Report_Automation/public ./public
COPY Frontend/Report_Automation/src ./src
COPY Frontend/Report_Automation/References ./References
COPY Frontend/Report_Automation/tsconfig.app.json Frontend/Report_Automation/tsconfig.json Frontend/Report_Automation/tsconfig.node.json ./
COPY Frontend/Report_Automation/vite.config.ts ./

FROM frontend-base AS frontend-dev
CMD ["npm", "run", "dev","--","--host"]

FROM frontend-base AS frontend-build
CMD npm run build

###BACKEND STAGE###
FROM python:3.13 as backend-base
WORKDIR /usr/local/app
COPY Backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY Backend/auth.py Backend/db.py Backend/docx_builder.py Backend/extract_snapshot.py ./
COPY ["Backend/Headers Template.docx", "./"]
COPY Backend/server.py ./
CMD ["uvicorn", "server:app","--host","0.0.0.0" ,"--reload"]