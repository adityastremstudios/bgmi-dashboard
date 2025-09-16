const admin = require("firebase-admin");
const serviceAccount = require("./firebase-key.json"); // uploaded as Secret File in Render

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function saveMatchData(matchNumber, data) {
  await db.collection("matches").doc(`match_${matchNumber}`).set(data);
}

async function updateLiveData(data) {
  await db.collection("live").doc("state").set(data, { merge: true });
}

async function getLiveData() {
  const snapshot = await db.collection("live").doc("state").get();
  return snapshot.exists ? snapshot.data() : {};
}

module.exports = { saveMatchData, updateLiveData, getLiveData };
