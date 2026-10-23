require("dotenv").config();
const { sendWhatsApp } = require("./src/utils/whatsapp");

sendWhatsApp("9508734522", "GIGI India test: WhatsApp notification working!");
