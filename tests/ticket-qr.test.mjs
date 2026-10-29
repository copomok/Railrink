import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {ticketMatrix,ticketQR} from '../js/ticket-qr.js';
test('ticket ID QR matches independently generated version 3-L / byte / mask 0 reference',()=>{
 // Reference produced with Python qrcode 8.2, QRData MODE_8BIT_BYTE, no border.
 const id='RL-12345678-1234-1234-1234-123456789abc';
 assert.equal(createHash('sha256').update(JSON.stringify(ticketMatrix(id))).digest('hex'),'b3ec3b2ea2f2a316e33e974505b6ac5440cd34776f691c547d9cbadec4c810fd');
 assert.match(ticketQR(id),/실제 탑승 불가/);assert.throws(()=>ticketMatrix('personal information'));
});
