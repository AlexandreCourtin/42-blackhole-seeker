module.exports = {
	apps : [{
		name: 'website',
		script: 'index.js',
		watch: false
	},{
		name: 'ddb',
		script: 'database.js',
		watch: false,
		cron_restart: '0 0 * * *'
	}],

	deploy : {
		production : {
			user : 'SSH_USERNAME',
			host : 'SSH_HOSTMACHINE',
			ref  : 'origin/master',
			repo : 'GIT_REPOSITORY',
			path : 'DESTINATION_PATH',
			'pre-deploy-local': '',
			'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
			'pre-setup': ''
		}
	}
};
