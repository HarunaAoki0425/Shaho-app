const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Firebase Admin初期化
const serviceAccount = require('./serviceAccountKey.json');
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

// JSONデータを読み込み
const insuranceRates = JSON.parse(fs.readFileSync('nenkin_standardMonthlySarary.json', 'utf-8'));

// コレクションに追加
async function importData() {
  const batch = db.batch();
  insuranceRates.forEach((item, index) => {
    const docRef = db.collection('nenkin_standardMonthlySarary').doc(String(item.nenkinGrade));
    const data = {
      ...item,
      nenkinStart: item.nenkinStart === '' ? null : item.nenkinStart,
      nenkinEnd: item.nenkinEnd === '' ? null : item.nenkinEnd,
    };
    batch.set(docRef, data);
  });

  await batch.commit();
  console.log('アップロード完了 ✅');
}

importData();
