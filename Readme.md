## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)

### Installation

## 1. Clone the repository:

```
git clone https://github.com/jainhardik120/gatepay_server.git
```    

Install dependencies:

```
npm install
```

## 2. Environment Variables

Create a .env file in the project root and add the following variables:
```
POSTGRES_URL: Your PostgreSQL database connection URL.
SECRET_KEY: Your secret key for JWT token generation.
PORT: The port on which the server will run.
```

Example .env file:

env

```
POSTGRES_URL=your-postgres-connection-url
SECRET_KEY=your-secret-key
PORT=3000
```

### Running the Application

Use the following npm scripts to run the application:

## To start the development server with nodemon:

    npm run dev

## To start the production server:

    npm start

# Routes
User Registration

    URL: /api/auth/register
    Method: POST
    Request Body:
        Name (string, required): The user's name.
        Email (string, required): The user's email address.
        Password (string, required): The user's password.
    Response:
        user (object): The registered user's information.
        token (string): JWT token for authentication.

User Login

    URL: /api/auth/login
    Method: POST
    Request Body:
        Email (string, required): The user's email address.
        Password (string, required): The user's password.
    Response:
        user (object): The authenticated user's information.
        token (string): JWT token for authentication.