const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

exports.callback = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  admin.database().ref('/device/'+uid).push(req.query).then(snapshot => {
    res.send("OK");
  });
});
