const functions = require('firebase-functions');
const admin = require('firebase-admin');
var serviceAccount = require("./tf-sigfox-dev-firebase-adminsdk-bjtm5-05fc32cf0e.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tf-sigfox-dev.firebaseio.com"
});

exports.callback = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  admin.database().ref('/device/'+uid).push(req.query).then(snapshot => {
    res.send("OK");
  });
});

//フォーマット 引数可変（配列)
let formatByArr = function(msg) {
    var args = [];
    for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
    }
    return msg.replace(/\{(\d+)\}/g, function (m, k) {
        return args[k];
    });
};

// 16進文字列をバイト値に変換
let hexToByte = function (hex_str){
  return parseInt(hex_str, 16);
};

//data を n文字づつ分割
let splitByLength = function (str, n) {
  return str.match( new RegExp(".{1,"+n+"}","g") );
};

//https://www.thinxtra.com/wp-content/uploads/2017/07/Sensit-Payload-Decoding-Guide.pdf
//https://github.com/sigfox/sensitv2-decoder
// https://XXXXX/sensit?uid=XXXX&data=A9670d19
// 例) backend.sigfox のコールバックに入れる値
// https://us-central1-tf-sigfox-dev.cloudfunctions.net/sensit?uid={device}&data={data}
exports.sensit = functions.https.onRequest((req, res) => {
  const uid = req.query.uid;
  //data として受け取った sensit 生データを 2バイト毎にわけて 4byte の配列に変換
  let dataArr = [];
  splitByLength(req.query.data,2).forEach(function(v, i, a){
    dataArr[i] = hexToByte(v);
  });
  console.log("dataArr ",dataArr);
  let data = new Buffer(dataArr);

  //Uplink パケットをフォーマットに従って解析
  let b1 = data.readUInt8(0);
  let b2 = data.readUInt8(1);
  let b3 = data.readUInt8(2);
  let b4 = data.readUInt8(3);
  console.log("b1 ",b1.toString(2)); // 10101001
  console.log("b2 ",b2.toString(2)); // 1100111
  console.log("b3 ",b3.toString(2)); // 1101
  console.log("b4 ",b4.toString(2)); // 11001

  //mode 1byte目の 2,1,0
  let v = formatByArr("{0}{1}{2}",String(b1&0x00000100),String(b1&0x00000010),String(b1&0x00000001));
  let mode = parseInt(v,2); // 1
  console.log("mode ",v,mode);

  //TimeFrame 1byte目の 4,3
  v = formatByArr("{0}{1}",String(b1&0x00010000),String(b1&0x00001000));
  let timeFrame = parseInt(v,2); //1
  console.log("timeFrame ",v,timeFrame);

  //type 1byte目の 6,5
  let type = parseInt(formatByArr("{0}{1}",b1&0x01000000,b1&0x00100000),2); //1
  //Battery MSB 1byte目の 7
  let batteryMSB = parseInt(formatByArr("{0}",b1&0x10000000),2); //1

  //Battery LSB 2byt目の 3,2,1,0
  let batteryLSB = parseInt(formatByArr("{0}{1}{2}{3}",b2&0x00001000,b2&0x00000100,b2&0x00000010,b2&0x00000001),2); // 0111

  let battery = parseInt(formatByArr("{0}{1}",batteryMSB,batteryLSB),2)*0.05*2.7;

  //T° MSB 2byt目の 7,6,5,4
  let tMSB = parseInt(formatByArr("{0}{1}{2}{3}",b2&0x10000000,b2&0x01000000,b2&0x00100000,b2&0x00100000),2); //0110
  let tmsb = (tMSB*6.4)-20;

  //T° LSB 3byt目の 5,4,3,2,1,0
  let tLSB = parseInt(formatByArr("{0}{1}{2}{3}{4}{5}",b3&0x00100000,b3&0x00010000,b3&0x00001000,b3&0x00000100,b3&0x00000010,b3&0x00000001),2); //001101
  let t = (parseInt(formatByArr("{0}{1}",tMSB,tLSB),2)-200)/8;

  //Reed Switch state mode=5, 3byt目の 6
  let reedSwitchState = (mode != 5)?0:parseInt(formatByArr("{0}",b3&0x01000000),2); //1
  //Multiplier light mode=2, 3byt目の 7,6
  let multiplierLight = (mode != 2)?0:parseInt(formatByArr("{0}{1}",b3&0x10000000,b3&0x01000000),2); //1
  //Value light mode=2, 3byt目の 5,4,3,2,1,0
  let valueLight = (mode != 2)?0:parseInt(formatByArr("{0}{1}{2}{3}{4}{5}",b3&0x00100000,b3&0x00010000,b3&0x00001000,b3&0x00000100,b3&0x00000010,b3&0x00000001),2); //1

  //Humidity 4byt目の 5,4,3,2,1,0
  let humidity = parseInt(formatByArr("{0}{1}{2}{3}{4}{5}",b4&0x00100000,b4&0x00010000,b4&0x00001000,b4&0x00000100,b4&0x00000010,b4&0x00000001),2); //0001100
  //Minor version mode=0,4byte目の 7,6,5
  let minorVersion = (mode==0)?0:parseInt(formatByArr("{0}{1}",b4&0x10000000,b4&0x01000000,b4&0x00100000),2);
  //Major version mode=0,4byte目の 4,3,2,1,0
  let majorVersion = (mode==0)?0:parseInt(formatByArr("{0}{1}{2}{3}{4}",b4&0x00010000,b4&0x00001000,b4&0x00000100,b4&0x00000010,b4&0x00000001),2);
  //Nb of alerts mode=0|1, 4byte目の 7,6,5,4,3,2,1,0
  let nbOfAlerts = (mode==0|mode==1)?0:parseInt(formatByArr("{0}{1}{2}{3}{4}{5}{6}{7}",b4&0x10000000,b4&0x01000000,b4&0x00100000,b4&0x00010000,b4&0x00001000,b4&0x00000100,b4&0x00000010,b4&0x00000001),2);

  let result = {"mode":mode,
                        "timeFrame":timeFrame,
                        "type":type,
                        "battery":battery,
                        "tMSB":tmsb,
                        "t":t,
                        "reedSwitchState":reedSwitchState,
                        "multiplierLight":multiplierLight,
                        "valueLight":valueLight,
                        "humidity":humidity,
                        "minorVersion":minorVersion,
                        "majorVersion":majorVersion,
                        "nbOfAlerts":nbOfAlerts};

  admin.database().ref('/device/'+uid).push(result).then(snapshot => {
    res.status(200).json(result);
  });
});
