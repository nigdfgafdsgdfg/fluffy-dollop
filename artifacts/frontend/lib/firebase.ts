import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCYzqeqdKaa6WtCyYEZ4fBsZpp0JRM6ZNw",
  authDomain: "server-e4782.firebaseapp.com",
  projectId: "server-e4782",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export default app;
