import admin from "firebase-admin";
import { logger } from "./logger";

let initialized = false;

export function getFirebaseApp(): admin.app.App {
  if (initialized) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info("Firebase initialized with service account JSON");
  } else if (projectId) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    logger.info({ projectId }, "Firebase initialized with application default credentials");
  } else {
    logger.warn(
      "No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID. Running in emulator mode."
    );
    process.env.FIREBASE_AUTH_EMULATOR_HOST =
      process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "localhost:9099";
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST ?? "localhost:8080";
    admin.initializeApp({ projectId: "demo-project" });
    logger.info("Firebase initialized for local emulator");
  }

  initialized = true;
  return admin.app();
}

export function getFirestore(): admin.firestore.Firestore {
  return getFirebaseApp().firestore();
}

export function getAuth(): admin.auth.Auth {
  return getFirebaseApp().auth();
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;
