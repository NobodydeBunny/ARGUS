# ARGUS

<p align="center">
  <img src="https://img.shields.io/badge/Figma-UI%2FUX%20Analyzer-1E1E1E?style=for-the-badge&logo=figma&logoColor=white" />
  <img src="https://img.shields.io/badge/AI-Assisted-7C3AED?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Machine%20Learning-Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

<h3 align="center">
  AI-Assisted UI/UX Analysis for Figma
</h3>

<p align="center">
  <b>ARGUS examines interface designs, identifies potential usability problems, and turns them into actionable feedback.</b>
</p>

---

## 👁️ What is ARGUS?

**ARGUS UI Analyzer** is an AI-assisted **Figma plugin and backend system** built to evaluate user interface designs through structured design metadata.

ARGUS reads the properties and relationships of selected Figma elements, sends that information to its analysis backend, and evaluates the design across several usability-focused areas.

The system combines:

* **Metadata-based UI analysis**
* **Rule-based detection**
* **Machine learning**
* **Session tracking**
* **Issue history**
* **Recommendations**
* **Automated reporting**

The purpose is simple:

> **Help designers find usability problems while they are still designing.**

ARGUS is currently a working end-to-end prototype with Figma integration, backend processing, persistent analysis history, near real-time scanning, reporting, export functionality, and a starter machine-learning pipeline.

---

# ✦ Why ARGUS?

A UI can look polished and still contain usability problems.

Examples include:

* inconsistent spacing between similar components
* poor alignment
* inconsistent button styling
* unclear error states
* weak error visibility
* missing Close, Cancel, or Back controls
* destructive actions without undo
* irreversible actions without confirmation
* overloaded screens containing unnecessary controls

These problems can be easy to miss during manual design review.

ARGUS provides another layer of analysis by examining the structure and metadata of the interface and highlighting patterns that deserve attention.

It is intended as a **design assistance tool**, not a replacement for designers or UX researchers.

---

# 🧠 How ARGUS Works

```text
                    ┌─────────────────────┐
                    │     Figma Design    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    ARGUS Plugin     │
                    │ Metadata Extraction │
                    └──────────┬──────────┘
                               │
                               │ JSON
                               ▼
                    ┌─────────────────────┐
                    │    ARGUS Backend    │
                    │    Node + Express   │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
       Layout Analysis   Color Analysis   Error Handling
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Hybrid Analyzer   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Trained ML Model  │
                    └──────────┬──────────┘
                               │
                               ▼
                 ┌─────────────────────────┐
                 │ Issues + Recommendations│
                 └────────────┬────────────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
          ┌─────────────────┐     ┌─────────────────┐
          │ Supabase        │     │ Figma Plugin UI │
          │ PostgreSQL      │     │ Feedback Panel  │
          └────────┬────────┘     └─────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ Session Reports │
          │ & Export        │
          └─────────────────┘
```

---

# 🔍 Analysis Areas

ARGUS currently focuses on three major usability analysis areas, followed by recommendation generation.

## 1. Layout Analysis

ARGUS examines structural and visual layout patterns.

Examples include:

* Modal or dialog screens without visible exit options
* Inconsistent spacing between similar components
* Inconsistent button shapes
* Alignment inconsistencies
* Overloaded screens with unnecessary controls

---

## 2. Color Analysis

ARGUS examines color relationships and their use within UI states and actions.

Examples include:

* Inconsistent colors for the same action
* Different actions using the same color
* Error messages that visually blend with the interface
* Low-contrast error messages
* Poorly styled error states

---

## 3. Error Handling Analysis

ARGUS examines interaction patterns associated with potentially risky or disruptive actions.

Examples include:

* Missing Back, Cancel, or Close controls
* Destructive actions without undo
* Irreversible actions without confirmation

---

## 4. Feedback & Recommendations

After candidate issues are identified, ARGUS generates user-facing recommendations intended to explain the problem and suggest an appropriate direction for improvement.

---

# ⚡ Near Real-Time Scanning

ARGUS supports both **manual analysis** and **near real-time scanning**.

With near real-time scanning enabled, changes made to the selected Figma design can trigger another analysis cycle.

```text
Design Change
      │
      ▼
Metadata Re-extraction
      │
      ▼
Backend Analysis
      │
      ▼
Issue Detection
      │
      ▼
Status Update
      │
      ▼
Plugin Feedback
```

This allows ARGUS to follow the evolution of a design instead of treating every scan as an isolated event.

---

# 🧩 Hybrid Analysis Architecture

ARGUS does not depend on one analysis method.

The system combines several layers:

### Rule-Based Analysis

Explicit usability rules identify patterns that can be detected deterministically.

### Machine Learning

A trained metadata-based model classifies candidate issues and provides additional prediction information.

### Hybrid Analyzer

The hybrid analyzer brings the different module outputs together, removes duplicate findings, and produces the final set of issues and recommendations.

This architecture allows ARGUS to combine predictable rule-based checks with machine-learning-assisted classification.

---

# 🤖 Machine Learning Pipeline

The machine-learning side of ARGUS is built around Figma design metadata.

The pipeline is structured around:

```text
Figma Metadata
      │
      ▼
Dataset Preparation
      │
      ▼
Model Training
      │
      ▼
Saved Model
      │
      ▼
Prediction Script
      │
      ▼
Node.js Model Adapter
      │
      ▼
ARGUS Analysis Engine
```

The shared model interface allows the analysis modules to use a common prediction pipeline.

The prediction process can return information such as:

* Issue label
* Severity
* Suggestion category
* Confidence

---

# 🗂️ Project Structure

```text
ARGUS/
│
├── argus_backend/
│   │
│   ├── server.js
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   │
│   ├── database/
│   │
│   ├── controllers/
│   │
│   ├── routes/
│   │
│   ├── aiEngine/
│   │   ├── layoutAnalysisModule.js
│   │   ├── colorAnalysisModule.js
│   │   ├── errorHandlingModule.js
│   │   ├── feedbackRecommendationModule.js
│   │   ├── uiIssueModel.js
│   │   ├── trainedModelAdapter.js
│   │   └── hybridAnalyzer.js
│   │
│   ├── ml_training/
│   │
│   ├── dataset/
│   │
│   └── evaluation/
│
├── argus_plugin/
│   ├── manifest.json
│   ├── code.js
│   └── ui.html
│
├── MULTI_FRAME_ANALYSIS.md
├── README.md
└── .gitignore
```

---

# 🏗️ System Components

## `argus_plugin`

The Figma plugin is responsible for:

* Reading selected Figma nodes
* Extracting design metadata
* Starting manual scans
* Starting near real-time scans
* Sending metadata to the backend
* Displaying feedback
* Displaying report information
* Handling report exports
* Managing plugin termination

### Main files

**`manifest.json`**
Defines the Figma plugin configuration.

**`code.js`**
Contains the main plugin logic, metadata extraction, scan handling, backend communication, report handling, and plugin lifecycle management.

**`ui.html`**
Contains the interface displayed inside Figma.

---

# ⚙️ Backend

The ARGUS backend is built with **Node.js and Express.js**.

It provides the API layer between the Figma plugin, AI analysis pipeline, database, and reporting system.

Main responsibilities include:

* Receiving Figma metadata
* Managing analysis sessions
* Running AI analysis
* Storing detected issues
* Storing recommendations
* Updating issue status
* Generating reports
* Exporting reports
* Maintaining analysis history

---

# 🗄️ Database

ARGUS currently uses **Supabase with PostgreSQL** for persistent application data.

The database is used to maintain the history of analysis sessions rather than storing only the latest result.

The system tracks information such as:

* Analysis sessions
* Individual analyses
* Detected issues
* Suggestions
* Reports
* Issue status
* Resolution history
* Scan information
* Export history
* Model/version information

Conceptually:

```text
Analysis Session
       │
       ├── Analyses
       │      │
       │      └── Detected Issues
       │
       ├── Suggestions
       │
       ├── Reports
       │
       └── Export History
```

Supabase provides the PostgreSQL database layer used by the current ARGUS architecture.

---

# 📊 Session-Based Issue Tracking

ARGUS maintains issue history across scans within a session.

An issue can move through states such as:

```text
           ┌───────────────┐
           │ Issue Found   │
           └───────┬───────┘
                   │
                   ▼
            ┌────────────┐
            │    Open    │
            └─────┬──────┘
                  │
          Design changed
                  │
                  ▼
            ┌────────────┐
            │   Resolved │
            └────────────┘
```

This makes it possible to distinguish between issues that remain present and issues that disappear after a design change.

---

# 📑 Reporting

ARGUS can generate reports from the analysis session.

A report can include:

* Detected issues
* Severity information
* Suggestions
* Recommendations
* Issue history
* Resolved issues
* Session information
* Report status
* Export history

The backend can also export the generated report.

---

# 🧪 Evaluation

ARGUS includes an evaluation pipeline for assessing the machine-learning model.

Planned and ongoing evaluation includes:

* Train/test separation
* Confusion matrix
* Precision
* Recall
* F1 score
* Per-label performance
* Analysis time

The goal is to measure how reliably the model distinguishes between the defined UI issue categories.

---

# 📚 Datasets

The ARGUS datasets are hosted externally.

## Dataset

**[Download Dataset (.zip)](https://drive.google.com/file/d/17QxuUJ7PlzH7O1RBEfVelRx5gB7_1Y0A/view)**

## Dataset v2

**[Download Dataset v2 (.zip)](https://drive.google.com/file/d/1_5uqxqOr-kQNzakcvN9poU5qmp1Pqk7P/view)**

The datasets are kept outside the Git repository because of their size and distribution requirements.

---

# 🤖 Trained Model

The repository contains the machine-learning pipeline and model integration code.

The trained model itself can be distributed separately.

## Download

**[⬇ Download the Trained ARGUS Model](https://drive.google.com/drive/folders/1Yi9EQhudPv6AO8eY-TLP1d_zF3pHULAB)**

---

# 🚀 Getting Started

## Prerequisites

Install the following before running ARGUS:

* Node.js
* npm
* Python
* Figma Desktop
* A Supabase project
* Required Supabase database configuration
* Required environment variables
* Trained ARGUS model for the complete AI pipeline

---

## 1. Clone the Repository

```bash
git clone https://github.com/NobodydeBunny/ARGUS.git
cd ARGUS
```

---

## 2. Configure Supabase

Create or use a Supabase project and configure the required PostgreSQL database structure.

Then add the required Supabase configuration to the backend environment file:
add .env file with the port 5000 and Supabase url

```text
argus_backend/.env
```

Do not commit your private credentials or service keys to GitHub.

---

## 3. Start the Backend

Open a terminal inside:

```text
argus_backend
```

Install the dependencies:

```bash
npm install
```

Then start the development backend:

```bash
npm run dev
```

The backend is configured to run on the development server used by the ARGUS plugin.

---

## 4. Load the Plugin into Figma

Open **Figma Desktop**.

Go to:

```text
Plugins
    ↓
Development
    ↓
Import plugin from manifest...
```

Select:

```text
argus_plugin/manifest.json
```

Then launch:

```text
Plugins
    ↓
Development
    ↓
ARGUS UI Analyzer
```

---

## 5. Analyze a Design

1. Open a Figma design.
2. Select a frame, screen, component, or layer group.
3. Launch ARGUS.
4. Select **Analyze Selected Design**.
5. Review the extracted metadata.
6. Review detected issues and recommendations.

For continuous monitoring, enable near real-time scanning.

---

# 🔄 Complete Request Flow

```text
Figma
 │
 │ Selected Design
 ▼
ARGUS Plugin
 │
 │ Extract Metadata
 ▼
JSON Payload
 │
 ▼
Express Backend
 │
 ├───────────────┐
 │               │
 ▼               ▼
AI Engine     Supabase
 │               │
 ▼               ▼
Issues       Session Data
 │
 ▼
Recommendations
 │
 ▼
Figma Plugin
 │
 ▼
Session Report
 │
 ▼
Export
```

---

# 📌 Current Project Status

| Component                    | Status             |
| ---------------------------- | ------------------ |
| Figma Plugin                 | ✅ Working          |
| Metadata Extraction          | ✅ Implemented      |
| Manual Analysis              | ✅ Implemented      |
| Near Real-Time Scanning      | ✅ Implemented      |
| Backend API                  | ✅ Implemented      |
| Supabase PostgreSQL          | ✅ Current Database |
| Session Tracking             | ✅ Implemented      |
| Issue History                | ✅ Implemented      |
| Recommendation Storage       | ✅ Implemented      |
| Report Generation            | ✅ Implemented      |
| Report Export                | ✅ Implemented      |
| AI Module Architecture       | ✅ Implemented      |
| Starter ML Pipeline          | ✅ Implemented      |
| Larger Real Metadata Dataset | ✅ Implemented      |
| Final Model Training         | ✅ Implemented      |
| Full Model Evaluation        | ✅ Implemented      |
| AI Module Refinement         | 🔄 Ongoing          |

---

# 🛣️ Roadmap

## Data

* Expand the training dataset
* Collect real Figma metadata
* Improve labeling consistency
* Add examples covering every research objective

## AI

* Improve component similarity analysis
* Improve spacing comparison
* Improve alignment analysis
* Improve modal recognition
* Improve color clustering
* Improve contrast analysis
* Improve screen-flow analysis
* Improve context-aware recommendations

## Machine Learning

* Retrain the model with expanded data
* Improve classification performance
* Evaluate individual issue categories
* Improve confidence estimation

## Plugin

* Refine the interface
* Improve live scan feedback
* Improve issue history presentation
* Improve report preview
* Improve export workflow

## Reporting

* Improve report presentation
* Include model version
* Include session timeline
* Display resolved issue history more clearly
* Improve recommendation presentation

---

# 🔬 Research Direction

ARGUS explores how structured interface metadata can be used to support automated usability analysis.

The broader research direction is based on three ideas:

```text
Design Metadata
       +
Usability Knowledge
       +
Machine Learning
       ↓
Automated UI/UX Assistance
```

The project investigates whether information already available inside a design tool can be transformed into useful usability feedback without requiring the designer to manually inspect every interface property.

---

# 📖 Documentation

Additional documentation is available in the repository.

### Multi-Frame Analysis

See:

[`MULTI_FRAME_ANALYSIS.md`](MULTI_FRAME_ANALYSIS.md)

for information about the project's multi-frame analysis work.

---

# 👤 About

ARGUS is a research and development project focused on bringing AI-assisted usability analysis into the Figma design workflow.

The project combines Figma plugin development, backend engineering, database systems, usability analysis, and machine learning into a single tool.

ARGUS is built around a simple idea:

> **Catch usability problems earlier, while the interface is still being designed.**

---

# 👨‍💻 Developers
| Name | GitHub |
|------|--------|
| Sandakelum Kumarasiri | [@NobodydeBunny](https://github.com/NobodydeBunny) |
| Ranishka Gunathilake | [@RanishkaGunathilake](https://github.com/RanishkaGunathilake) |
| Chamath Pesara | [@ChamathPesara](https://github.com/ChamathPesara) |
| Praveen Mudalige | [@PraveenMudalige](https://github.com/PraveenMudalige) |
| Gayathma Balauriya | [@GayathmaBalasuriya](https://github.com/GayathmaBalasuriya) |

---

# ⚠️ Project Status

ARGUS is currently under active development.

The plugin, backend, database integration, analysis workflow, reporting system, and starter machine-learning pipeline are functional. The machine-learning side is still being improved through larger datasets, stronger analysis methods, and further evaluation.

---

# 📜 License

See the repository for licensing and usage information.

---

<div align="center">

# ARGUS

### **See the design. Find the problem. Improve the experience.**

**AI-Assisted UI/UX Analysis for Figma**

</div>
