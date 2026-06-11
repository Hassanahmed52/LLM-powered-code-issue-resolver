# LLM-powered Issue Resolver

An intelligent solution that leverages Large Language Models to automatically analyze, categorize, and provide resolutions for software issues and support tickets.

##  Live Demo

**[View Live Application](https://saas-project-8e6a7.firebaseapp.com/)**

##  Features

- **Intelligent Issue Analysis**: Automatically categorizes and analyzes issues using LLM
- **Smart Resolution Suggestions**: Provides context-aware solutions and recommendations
- **Real-time Processing**: Fast issue processing and response generation
- **User Authentication**: Secure login and user management
- **Responsive Design**: Works seamlessly across desktop and mobile devices

##  Tech Stack

### Frontend
- **Framework**: React.js
- **Hosting**: Firebase Hosting
- **Authentication**: Firebase Auth
- **Styling**: CSS/Tailwind CSS

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Deployment**: Render
- **LLM Integration**: OpenAI API / Anthropic API

##  Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account
- OpenAI/Anthropic API key

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Hassanahmed52/LLM-powered-code-issue-resolver.git
   cd LLM-powered-code-issue-resolver
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   ```

3. **Create secret config files**
   - Copy `frontend/.env.example` to `frontend/.env.local`
   - Copy `backend/.env.example` to `backend/.env`

4. **Run the application locally**
   ```bash
   # Start backend server
   cd backend
   npm start
   
   # In another terminal, start frontend
   cd ../frontend
   npm run dev
   ```

##  Deployment

### Frontend (Firebase)

1. Build and export the frontend for Firebase Hosting:
   ```bash
   cd frontend
   npm run export
   ```
2. Deploy to Firebase Hosting:
   ```bash
   npm run deploy:firebase
   ```
   If the CLI is not installed globally, install it with `npm install -g firebase-tools` or use the local script.
3. If you have a backend, host it separately (Cloud Run, Render, or Firebase Functions) and set `NEXT_PUBLIC_API_BASE_URL` to its public URL in `frontend/.env.local`.

### Backend

The backend must run on a separate Node.js host. You can deploy it to Render, Google Cloud Run, or Firebase Functions.

- Put your secrets in `backend/.env` only.
- Do not commit `backend/.env` or `frontend/.env.local` to git.
- Use the `backend/.env.example` file as a reference.

##  Secrets and config files

This repository includes example environment files so you can restore secrets safely.

- `frontend/.env.example` contains the public API base URL used by the frontend.
- `backend/.env.example` contains backend keys and service URLs.

When you deploy, keep the real credentials in your infrastructure's secret manager or in local `.env` files that are not committed.

##  Usage

1. **Sign Up/Login**: Create an account or login using Firebase Authentication
2. **Submit Issue**: Describe your technical issue or problem
3. **Get Analysis**: The LLM analyzes your issue and provides categorization
4. **View Solutions**: Receive intelligent suggestions and step-by-step resolutions
5. **Track History**: Access your previous issues and solutions
