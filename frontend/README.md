# AI-Driven Anomaly Detection in Component Burn-In & Screening

**SIH 2026 — Problem Statement 26170**

A local web application for detecting anomalous electronic components during burn-in/screening using:

* **Module A:** Dynamic statistical outlier detection
* **Module B:** Time-series drift prediction
* **FastAPI:** Backend/API layer
* **React + Vite:** Frontend/dashboard

The system accepts a CSV file, analyzes the component data, and displays PASS/REJECT decisions with supporting explanations.

---

# 1. Project Architecture

```text
                    CSV FILE
                       │
                       ▼
              ┌─────────────────┐
              │  React Frontend │
              │   CSV Upload    │
              └────────┬────────┘
                       │
                       │ POST /analyze
                       ▼
              ┌─────────────────┐
              │  FastAPI Backend│
              └────────┬────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
      ┌──────────────┐   ┌──────────────┐
      │   Module A   │   │   Module B   │
      │ Outlier      │   │ Drift        │
      │ Detection    │   │ Prediction   │
      └──────┬───────┘   └──────┬───────┘
             │                  │
             └────────┬─────────┘
                      ▼
                Final Verdict
                PASS / REJECT
                      │
                      ▼
              JSON Response
                      │
                      ▼
              React Dashboard
```

The intended demo interaction is:

```text
CSV Upload
    ↓
Instant Analysis
    ↓
Dashboard
    ↓
Component / Lot Details
    ↓
Module A + Module B explanations
```

---

# 2. Technology Stack

## Frontend

* React
* Vite
* JavaScript / JSX
* Recharts
* CSS

## Backend

* Python
* FastAPI
* Uvicorn
* Pandas
* NumPy
* Scikit-learn
* Joblib

## Communication

```text
React → HTTP POST → FastAPI
```

API endpoint:

```text
POST /analyze
```

---

# 3. Repository Structure

```text
project-root/
│
├── backend/
│   ├── main.py
│   ├── module_a.py
│   ├── module_b.py
│   ├── schemas.py
│   ├── requirements.txt
│   │
│   ├── models/
│   │   └── driftguard_module_b.pkl
│   │
│   ├── data/
│   │   └── SIH_Dataset_v1.0.csv
│   │
│   └── tests/
│       ├── test_module_a.py
│       └── test_module_b.py
│
├── frontend/
│   ├── package.json
│   ├── index.html
│   │
│   ├── public/
│   │   └── synthetic_components_500.csv
│   │
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       │
│       ├── components/
│       │   ├── Header.jsx
│       │   └── Sidebar.jsx
│       │
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── DataUpload.jsx
│       │   ├── Components.jsx
│       │   ├── ComponentDetails.jsx
│       │   ├── Prediction.jsx
│       │   └── LotAnalysis.jsx
│       │
│       └── utils/
│           ├── csvData.js
│           └── analysisData.js
│
└── README.md
```

> Folder names may differ slightly depending on how the frontend/backend repositories are combined. The important requirement is that the React app and FastAPI backend remain separately runnable.

---

# 4. Requirements

Install the following before starting:

### Required

* Python 3.13
* Node.js
* npm
* Git

Recommended:

* VS Code
* Chrome/Chromium browser

---

# 5. Backend Setup

Open a terminal in the backend directory.

## Step 1 — Create virtual environment

Windows:

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

Verify Python:

```bash
python --version
```

Expected:

```text
Python 3.13.x
```

---

## Step 2 — Install dependencies

```bash
pip install -r requirements.txt
```

The backend uses the following important versions:

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
python-multipart==0.0.20
pandas==2.2.3
numpy==2.1.3
scikit-learn==1.6.1
joblib==1.4.2
pydantic==2.10.4
```

**Important:** The saved Module B model was created with scikit-learn 1.6.1. Do not casually upgrade scikit-learn without checking model compatibility.

---

# 6. Start the Backend

From the `backend` directory:

```bash
.venv\Scripts\activate
uvicorn main:app
```

The server should start at:

```text
http://127.0.0.1:8000
```

You should see something similar to:

```text
Uvicorn running on http://127.0.0.1:8000
```

---

# 7. Verify the Backend

Open:

```text
http://127.0.0.1:8000/docs
```

FastAPI Swagger UI should appear.

Check:

```text
GET /health
```

It should return a successful response.

Then test:

```text
POST /analyze
```

Upload:

```text
SIH_Dataset_v1.0.csv
```

The endpoint should return the analysis results.

---

# 8. Frontend Setup

Open a **second terminal**.

Go to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

---

# 9. Start the Frontend

Run:

```bash
npm run dev
```

Vite should provide a local address, normally:

```text
http://localhost:5173
```

Open it in your browser.

---

# 10. Run Both Applications

You need **two terminals** running at the same time.

### Terminal 1 — Backend

```bash
cd backend
.venv\Scripts\activate
uvicorn main:app
```

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# 11. How the Data Flow Works

When a user uploads a CSV:

```text
User selects CSV
       ↓
React DataUpload
       ↓
POST /analyze
       ↓
FastAPI
       ↓
Module A
       +
Module B
       ↓
Final Verdict
       ↓
JSON returned to React
       ↓
Stored in browser Local Storage
       ↓
Dashboard + other pages
```

The frontend stores:

```text
burnInUploadedCSV
```

for the uploaded CSV data.

It stores:

```text
burnInAnalysisResults
```

for the backend analysis results.

The other pages read these shared results instead of independently running their own screening logic.

---

# 12. Module A — Outlier Detection

Module A uses statistical analysis.

For each:

```text
Lot
Parameter
Timestamp
```

the system calculates:

```text
Median
MAD
z-score
```

The purpose is to identify components that behave abnormally relative to their lot.

Module A is intentionally **statistics-only**.

It does not use an ML model.

The explanation can contain information such as:

```text
leakage_uA 45.0 vs lot median 10.0
```

along with the calculated MAD-based deviation.

---

# 13. Module B — Drift Prediction

Module B predicts future drift.

The intended inputs include:

```text
Value at 0h
Value at 24h
```

and the model forecasts:

```text
Value at 168h
```

The system then compares the predicted drift against the calculated safety slope.

The safety slope is based on the **95th percentile drift rate of known-good components**, calculated globally per parameter.

The objective is to identify components whose future behavior is concerning even when their current absolute values may not violate a simple static limit.

---

# 14. Final Screening Decision

The final verdict combines both modules.

Conceptually:

```text
Module A flagged?
       │
       ├── YES ──► REJECT
       │
       └── NO
             │
             ▼
       Module B flagged?
             │
             ├── YES ──► REJECT
             │
             └── NO ──► PASS
```

Therefore:

```text
Final REJECT = Module A OR Module B flagged
```

The frontend must display the backend verdict rather than independently creating a different screening decision.

---

# 15. Frontend Pages

## Dashboard

Displays overall analysis information:

* Total components
* PASS count
* REJECT count
* Module A flags
* Module B flags
* Lot-level screening information

---

## Data Upload

Responsible for:

* Selecting CSV
* Sending CSV to FastAPI
* Receiving analysis results
* Storing uploaded CSV
* Storing analysis results

---

## Components

Displays:

* Component list
* Component status
* Search/filter functionality
* Backend screening verdict

---

## Component Details

Displays:

* Component information
* Measurements
* Final verdict
* Module A result
* Module B result
* Explanation/reason
* Relevant measurements/charts

---

## Prediction

Displays Module B-related information including:

* Component measurements
* Drift information
* Prediction information returned by the backend
* Safety information
* Module B flag
* Final verdict

---

## Lot Analysis

Displays:

* Lot-level component information
* 168h measurements
* Baseline/reference information
* Backend screening result

---

# 16. Testing Checklist

Use this checklist whenever the project is pulled onto a new machine or before a presentation.

## A. Environment

* [ ] Python 3.13 is installed
* [ ] Node.js is installed
* [ ] Git is installed
* [ ] Backend virtual environment created
* [ ] Backend virtual environment activated
* [ ] `pip install -r requirements.txt` completed
* [ ] `npm install` completed

---

## B. Backend

* [ ] `uvicorn main:app` starts successfully
* [ ] No dependency errors appear
* [ ] `http://127.0.0.1:8000` is reachable
* [ ] `/docs` opens successfully
* [ ] `/health` responds successfully
* [ ] `/analyze` appears in Swagger
* [ ] CSV upload through `/analyze` succeeds
* [ ] JSON analysis response is returned
* [ ] Module A result is present
* [ ] Module B result is present
* [ ] Final verdict is present

---

## C. Frontend

* [ ] `npm run dev` starts successfully
* [ ] React application opens
* [ ] Dashboard loads
* [ ] No red errors appear in browser console
* [ ] Sidebar/navigation works
* [ ] Data Upload page works
* [ ] CSV file can be selected
* [ ] Upload/analysis completes successfully

---

## D. Integration

* [ ] React can communicate with FastAPI
* [ ] `POST /analyze` is successfully called from React
* [ ] No CORS error appears
* [ ] Backend response reaches React
* [ ] Uploaded CSV is stored in Local Storage
* [ ] Analysis results are stored in Local Storage
* [ ] Dashboard uses analysis results
* [ ] Components page uses backend verdict
* [ ] Component Details uses backend verdict
* [ ] Prediction uses Module B result
* [ ] Lot Analysis uses backend verdict

---

# 17. Local Storage Verification

Open Chrome:

```text
F12
→ Application
→ Local Storage
→ http://localhost:5173
```

Verify these keys exist:

```text
burnInUploadedCSV
burnInAnalysisResults
```

You can also open Console and run:

```javascript
localStorage.getItem("burnInUploadedCSV")
```

and:

```javascript
JSON.parse(localStorage.getItem("burnInAnalysisResults"))
```

If testing with a completely new CSV, old analysis data should be cleared/replaced before testing.

To clear local storage manually:

```javascript
localStorage.clear()
```

Then upload the CSV again.

---

# 18. Full End-to-End Test

Perform this test before a demo.

### Step 1

Start FastAPI.

```bash
uvicorn main:app
```

### Step 2

Start React.

```bash
npm run dev
```

### Step 3

Open the frontend.

```text
http://localhost:5173
```

### Step 4

Clear old Local Storage data if necessary.

### Step 5

Upload:

```text
SIH_Dataset_v1.0.csv
```

### Step 6

Wait for analysis to complete.

### Step 7

Open Dashboard.

Verify:

```text
Total components
PASS
REJECT
Module A flags
Module B flags
```

### Step 8

Open Components.

Verify component statuses.

### Step 9

Open Component Details.

Verify:

```text
Module A
Module B
Final Verdict
Explanation
Measurements
```

### Step 10

Open Prediction.

Verify Module B prediction information.

### Step 11

Open Lot Analysis.

Verify lot and component screening results.

### Step 12

Pick a rejected component.

Confirm that its verdict remains consistent across:

```text
Dashboard
Components
Component Details
Prediction
Lot Analysis
```

---

# 19. Demo Checklist

Before presenting:

## Machine

* [ ] Laptop is charged
* [ ] Charger available
* [ ] Internet is not required for the core local demo
* [ ] Backend starts successfully
* [ ] Frontend starts successfully
* [ ] Correct browser tab is ready
* [ ] Dataset is available locally
* [ ] Model file is available
* [ ] No unnecessary applications are consuming resources

## Application

* [ ] Backend running
* [ ] Frontend running
* [ ] `/docs` tested
* [ ] CSV upload tested
* [ ] Dashboard tested
* [ ] Component details tested
* [ ] Prediction tested
* [ ] Lot analysis tested
* [ ] No console errors
* [ ] No CORS errors
* [ ] PASS/REJECT results are visible
* [ ] Charts render correctly

## Presentation

* [ ] Demo dataset prepared
* [ ] Demo flow rehearsed
* [ ] Team understands Module A
* [ ] Team understands Module B
* [ ] Team understands final verdict logic
* [ ] Team understands why Module A is statistical
* [ ] Team understands why a simple regression model is used
* [ ] Team can explain the safety slope
* [ ] Team can explain the JSON/API flow
* [ ] Team can explain what is future scope
* [ ] Slides contain screenshots/numbers from the actual working application

---

# 20. What We Are NOT Building

Do not introduce unnecessary scope during the current demo.

The current project explicitly does **not** include:

* Deep learning
* LSTM
* Transformers
* Isolation Forest for Module A
* Multivariate ML for Module A
* Gradient Boosting/XGBoost for Module B
* Live single-component entry
* Authentication/JWT
* User accounts
* Database
* Cloud deployment

The current demo is intentionally:

```text
CSV
 ↓
React
 ↓
FastAPI
 ↓
Module A + Module B
 ↓
PASS / REJECT
 ↓
Dashboard
```

This keeps the solution explainable and feasible for the current timeline.

---

# 21. Team Responsibilities

| Member       | Responsibility                                         |
| ------------ | ------------------------------------------------------ |
| **Mohit**    | Module A — statistical outlier detection               |
| **Satvik**   | Module B — drift prediction + ML/model supervision     |
| **Jangela**  | React frontend/UI                                      |
| **Ashutosh** | FastAPI + frontend/backend integration                 |
| **Akanksha** | Presentation + slides                                  |
| **Rishi**    | References, proofreading, template compliance, support |

Everyone should communicate progress in the SIH group as work starts, progresses, and finishes.

---

# 22. Troubleshooting

## Backend doesn't start

Check:

```bash
python --version
```

Make sure the virtual environment is active:

```bash
.venv\Scripts\activate
```

Then:

```bash
pip install -r requirements.txt
```

---

## Frontend doesn't start

Run:

```bash
npm install
```

Then:

```bash
npm run dev
```

---

## CORS error

Make sure FastAPI is running on:

```text
http://127.0.0.1:8000
```

and React is running on the expected Vite development address.

---

## Dashboard shows old data

Clear Local Storage:

```javascript
localStorage.clear()
```

Refresh the page and upload the CSV again.

---

## Prediction information is missing

Check:

```javascript
JSON.parse(localStorage.getItem("burnInAnalysisResults"))
```

Verify that the backend response contains the Module B information expected by the frontend.

---

## `/analyze` fails

First test the endpoint directly through:

```text
http://127.0.0.1:8000/docs
```

If it fails there, the issue is in the backend.

If it works in Swagger but fails from React, investigate the frontend/API connection or CORS configuration.

---

# 23. Quick Start

For experienced team members:

### Terminal 1

```bash
cd backend
.venv\Scripts\activate
uvicorn main:app
```

### Terminal 2

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

Upload the CSV and start the analysis.

---

# 24. Golden Rule for the Team

**If you finish your assigned task early, help whoever is currently blocked.**

For every important change:

```text
Starting → Working → Completed
```

post an update in the SIH group.

The objective is not only to have code that runs, but to have a system that **every team member can start, explain, test, and demo independently.**
