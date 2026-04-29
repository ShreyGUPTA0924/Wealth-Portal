// Vercel serverless entry — just re-export the Express app.
// Vercel picks this file up via vercel.json and handles all routing.
import app from '../src/app';
export default app;
