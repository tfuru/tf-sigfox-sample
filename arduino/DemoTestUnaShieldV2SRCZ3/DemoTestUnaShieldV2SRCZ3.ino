//  Send sample SIGFOX messages with UnaBiz UnaShield V2S Arduino Shield.
//  This sketch includes diagnostics functions in the UnaShield.
//  For a simpler sample sketch, see examples/send-light-level.
#include "SIGFOX.h"
#include <limits.h>

//  IMPORTANT: Check these settings with UnaBiz to use the SIGFOX library correctly.
static const String device = "NOTUSED";  //  Set this to your device name if you're using UnaBiz Emulator.
static const bool useEmulator = false;  //  Set to true if using UnaBiz Emulator.
static const bool echo = true;  //  Set to true if the SIGFOX library should display the executed commands.
static const Country country = COUNTRY_JP;  //  Set this to your country to configure the SIGFOX transmission frequencies.
static UnaShieldV2S transceiver(country, useEmulator, device, echo);  //  Uncomment this for UnaBiz UnaShield V2S Dev Kit
static String response;  //  Will store the downlink response from SIGFOX.

void setup() {  //  Will be called only once.
  //  Initialize console so we can see debug messages (9600 bits per second).
  Serial.begin(9600);
  Serial.println(F("Begin SIGFOX Module Setup"));
  
  //  Check whether the SIGFOX module is functioning.
  if (!transceiver.begin()) stop(F("Unable to init SIGFOX module, may be missing"));  //  Will never return.

  Serial.println(F("End SIGFOX Module Setup"));
}

static int counter = 0;
void loop(){
  Serial.print(F("\nRunning loop #"));
  Serial.println(counter);

  //int 2byte little-endian 
  String ctr = transceiver.toHex(counter);
  String t = transceiver.toHex(millis());
  transceiver.sendMessage(ctr+t);
  
  //  Delay 10 seconds before sending next message.
  Serial.println(F("Waiting 10 seconds..."));
  delay(10*1000);  

  counter++;
  if(counter == INT_MAX) counter = 0; 
}


