# PLS Command Center

An interactive Post-Legislative Scrutiny sandbox tool built for the WFD Certified Course on Legislative Scrutiny and Technology.

## Overview

This tool helps course participants learn and practice the methodology of Post-Legislative Scrutiny (PLS) as developed by the Westminster Foundation for Democracy.

## Features

- 🤖 **PLS Assistant** - AI-powered chatbot for PLS guidance using WFD methodology
- 🛠️ **PLS Tool** - Step-by-step wizard for conducting PLS
  - Context & Setup
  - Stakeholder Mapping
  - Consultation Design
  - Implementation Tracking
  - Impact Assessment
  - Export Report
- 📚 **Resources** - Links to WFD PLS publications
- ℹ️ **About** - Course and partner information
- 🔒 **Data Use** - Privacy and data handling information

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **AI**: Anthropic Claude API

## Development

```bash
cd app

# Install dependencies
npm install

# Run development server
npm run dev

# Run API server (separate terminal)
npm run server
```

## Environment Variables

Create a `.env` file in the `app` directory:

```
ANTHROPIC_API_KEY=your_api_key_here
```

## Deployment

Build the frontend:
```bash
npm run build
```

Start the production server:
```bash
npm run server
```

## Partners

**Organised by:**
- Westminster Foundation for Democracy (WFD)
- Institute of Advanced Legal Studies (IALS), University of London

**In partnership with:**
- Political Tech Summit
- POPVOX Foundation

## License

This is an experimental educational tool developed for training purposes.
