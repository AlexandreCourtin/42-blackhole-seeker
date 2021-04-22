const https = require("https");
const fs = require('fs');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 2001;
const { ClientCredentials } = require('simple-oauth2');

let ite = 1;
const config = {
	client: {
		id: '<client id>',
		secret: '<client secret>'
	},
	auth: {
		tokenHost: 'https://api.intra.42.fr/oauth'
	}
};

const tokenParams = {
	scope: 'public',
};

let accessToken;
let pageUser = 0;
let userIds = [];
let usersData = [];

for (let i = 0 ; i < 50 ; i++) {
	try {
		fs.unlinkSync('./userdata/users' + i + '.json');
	} catch (e) {}
}

async function init() {
	const client = new ClientCredentials(config);
	pageUser = 0;
	userIds = [];
	usersData = [];
	try {
		accessToken = await client.getToken(tokenParams);
	} catch (error) {
		console.log('Access Token error', error.message);
	}
}

// REQUEST STUDENT INFOS WITH ITS ID
function getUsersInfo() {
	const options = {
		'method': 'GET',
		'hostname': 'api.intra.42.fr',
		'path': '/v2/users/' + userIds[pageUser] + '/?access_token=' + accessToken.token.access_token,
	};
	const req = https.request(options, (res) => {
		let data;
		res.on("data", d => {
			data += d;
		});
		res.on("end", () => {
			try {
				const json = JSON.parse(data.substring(9));
				let finished = false;

				// IF STUDENT HAS 42CURSUS AND IS A LEARNER WHO HAS BEGUN ITS CURSUS
				if (json.cursus_users) {
					json.cursus_users.map((cursus) => {
						if (cursus.blackholed_at && cursus.cursus.name == '42cursus' && cursus.grade == 'Learner' && cursus.level > 0 && !finished) {
							const now = Date.now();
							const begin_at = new Date(cursus.begin_at);
							const blackholed_at = new Date(cursus.blackholed_at);
							const dureeun = now - begin_at.getTime();
							const dureedeux = blackholed_at.getTime() - now;

							if (dureeun >= 0 && dureedeux >= 0) {
								// IF STUDENT IS ACTIVE AND HAS SUBMITED A PROJECT IN THE LAST 5 MONTH
								if (json.projects_users) {
									let userIsActive = false;
									json.projects_users.map((project) => {
										if (project.status == 'finished' && project.marked_at) {
											const marked_at = new Date(project.marked_at);
											const past_now = new Date(Date.now());
											past_now.setMonth(past_now.getMonth() - 3);
											const dureetrois =  marked_at.getTime() - past_now.getTime();
											if (dureetrois >= 0) {
												userIsActive = true;
											}
										}
									});

									if (userIsActive) {
										usersData.push({ id: json.id, login: json.login, blackholed_at: cursus.blackholed_at });
									}
								}
							}
							finished = true;
						}
					});
				}
			} catch (e) {}
		});
	});
	req.end();
	if (pageUser + 1 < userIds.length) {
		pageUser++;
		setTimeout(getUsersInfo, 2000);
	} else {
		console.log('\x1b[32mIteration ' + ite + ' Done\x1b[0m');
		fs.writeFileSync('./userdata/users'+ite+'.json', JSON.stringify(usersData));
		fs.chmodSync('./userdata/users'+ite+'.json', 0o600);
	}
}

// REQUEST 100 STUDENT IDS
function getUsers() {
	if (ite <= 40) {
		setTimeout(() => {
			ite += 1;
			init().then(() => {
				getUsers();
			});
		}, 600000);
	}

	const options = {
		'method': 'GET',
		'hostname': 'api.intra.42.fr',
		'path': '/v2/cursus/21/users/?access_token=' + accessToken.token.access_token + '&per_page=100&filter[primary_campus_id]=1&page=' + ite + '&filter[staff?]=false&sort=-pool_year&range[pool_year]=0,3000'
	};
	const req = https.request(options, (res) => {
		let data;
		res.on("data", d => {
			data += d;
		});
		res.on("end", () => {
			const json = JSON.parse(data.substring(9));
			json.map((j) => {
				userIds.push(j.id);
			});
			console.log('\x1b[32mFetched ' + userIds.length + ' students ids\x1b[0m');
			getUsersInfo();
		});
	});
	req.end();
}

init().then(() => {
	getUsers();
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));