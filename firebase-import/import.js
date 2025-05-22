const admin = require('firebase-admin');
const fs = require('fs');

// Firebase Admin初期化
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// JSONデータを読み込み
const insuranceRates = JSON.parse(fs.readFileSync('nenkin_standardMonthlySarary.json', 'utf-8'));

// コレクションに追加
async function importData() {
  const batch = db.batch();
  insuranceRates.forEach((item, index) => {
    const docRef = db.collection('nenkin_standardMonthlySarary').doc(`${item.nenkinGrade}`);
    batch.set(docRef, item);
  });

  await batch.commit();
  console.log('アップロード完了 ✅');
}

importData();
