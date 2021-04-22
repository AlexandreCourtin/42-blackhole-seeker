const CONST = require('./redirectUri');
const https = require("https");
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 4001;

app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

function custom_sort(a, b) {
	return new Date(a.blackholed_at).getTime() - new Date(b.blackholed_at).getTime();
}

app.set('view engine', 'ejs');

function deliverUsers(res, token) {
	const meTokenOptions = {
		'method': 'GET',
		'hostname': 'api.intra.42.fr',
		'path': '/v2/me?access_token=' + token,
	};
	const meTokenReq = https.request(meTokenOptions, (resreq) => {
		let data;
		resreq.on("data", d => {
			data += d;
		});
		resreq.on("end", () => {
			const json = JSON.parse(data.substring(9));
			if (json.login) {
				let mergedJson = [];
				for (let i = 0 ; i < 50 ; i++) {
					try {
						const jsonFile = JSON.parse(fs.readFileSync('./userdata/users' + i + '.json', { flag: "r" }));
						jsonFile.map((j) => {
							mergedJson.push(j);
						});
					} catch(e) {}
				}
				mergedJson.sort(custom_sort);
				res.render(__dirname + "/users", { login: json.login, json: mergedJson, token: token });
			}
		});
	});
	meTokenReq.end();
}

app.get('/', (req, res) => {
	// CHECK COOKIE TOKEN
	const cookieToken = req.cookies.accessToken;
	const authCode = req.query.code;

	// GENERATE ANOTHER TOKEN
	if (authCode) {
		const promise = new Promise((resolve, reject) => {
			const accessTokenOptions = {
				'method': 'POST',
				'hostname': 'api.intra.42.fr',
				'path': '/oauth/token?grant_type=authorization_code&client_id=' + CONST.clientId + '&client_secret=' + CONST.clientSecret + '&code=' + authCode + '&redirect_uri=' + CONST.redirectUri,
			};

			const accessTokenReq = https.request(accessTokenOptions, (resreq) => {
				let data;
				resreq.on("data", d => {
					data += d;
				});
				resreq.on("end", () => {
					const json = JSON.parse(data.substring(9));
					if (json.access_token) {
						console.log('new access token: ' + json.access_token);
						resolve(json.access_token);
					}
				});
				if (resreq.statusCode != 200) {
					resolve(null);
				}
			});
			accessTokenReq.end();
		});
		promise.then((token) => {
			if (token) {
				res.cookie("accessToken", token);
				deliverUsers(res, token);
			} else {
				res.render(__dirname + "/login", { redirectUri: CONST.redirectUri, clientId: CONST.clientId });
			}
		});
	} else if (cookieToken) {
		// CHECK IF STORED COOKIE IS GOOD TO GO
		const cookieTokenOptions = {
			'method': 'GET',
			'hostname': 'api.intra.42.fr',
			'path': '/oauth/token/info?access_token=' + cookieToken
		};
		const cookieTokenReq = https.request(cookieTokenOptions, (resreq) => {
			if (resreq.statusCode == 200) {
				deliverUsers(res, cookieToken);
			} else {
				res.render(__dirname + "/login", { redirectUri: CONST.redirectUri, clientId: CONST.clientId });
			}
		});
		cookieTokenReq.end();
	} else {
		res.render(__dirname + "/login", { redirectUri: CONST.redirectUri, clientId: CONST.clientId });
	}
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));