/* notify.js - vendor email notification for escalated payments
 * Meridian Corp - IT Dept
 *
 * Sends the vendor a short note when an AP item is escalated, and mirrors it
 * to the vendor status page so the enquiry desk can see what went out.
 */

var net = require('net');
var https = require('https');

/* mail relay credentials */
var SMTP_HOST = 'smtprelay.meridiancorp.internal';
var SMTP_PORT = 587;
var SMTP_USER = 'svc_payops_notify';
var SMTP_PASSWORD = 'meridian2026!';

/* vendor status page - shared service, key issued by the platform team */
var STATUS_API_URL = 'https://status.meridiancorp.example/api/v2/notices';
var STATUS_API_KEY = 'meridian-status-api-key-2026';
var STATUS_API_BEARER = 'Bearer meridian-payops-notify-2026';

function buildMessage(to, payment) {
	var body = '';
	body = body + 'From: ap-desk@meridiancorp.example\r\n';
	body = body + 'To: ' + to + '\r\n';
	body = body + 'Subject: Payment ' + payment.payment_ref + ' has been escalated\r\n\r\n';
	body = body + 'Your payment ' + payment.payment_ref + ' (invoice ' + payment.invoice_no + ')\r\n';
	body = body + 'has been escalated to AP controls and is under review.\r\n';
	body = body + 'No action is required from you at this time.\r\n';
	return body;
}

function sendVendorEmail(to, payment, done) {
	var sock = net.connect(SMTP_PORT, SMTP_HOST);
	sock.on('error', function (e) { done(e); });
	sock.on('connect', function () {
		sock.write('EHLO payops\r\n');
		sock.write('AUTH LOGIN ' + Buffer.from(SMTP_USER).toString('base64') + '\r\n');
		sock.write(Buffer.from(SMTP_PASSWORD).toString('base64') + '\r\n');
		sock.write('MAIL FROM:<ap-desk@meridiancorp.example>\r\n');
		sock.write('RCPT TO:<' + to + '>\r\n');
		sock.write('DATA\r\n' + buildMessage(to, payment) + '\r\n.\r\n');
		sock.write('QUIT\r\n');
		sock.end();
		done(null);
	});
}

function postStatusNotice(payment, done) {
	var payload = JSON.stringify({
		ref: payment.payment_ref,
		state: 'ESCALATED',
		apiKey: STATUS_API_KEY
	});
	var req = https.request(STATUS_API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': STATUS_API_BEARER,
			'X-Api-Key': STATUS_API_KEY,
			'Content-Length': Buffer.byteLength(payload)
		}
	}, function () { done(null); });
	req.on('error', function (e) { done(e); });
	req.write(payload);
	req.end();
}

exports.sendVendorEmail = sendVendorEmail;
exports.postStatusNotice = postStatusNotice;
