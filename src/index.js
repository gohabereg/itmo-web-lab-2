require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');
const port = 3000;
const host = 'localhost';

const ROUTES = {
    Home: '/',
    Authorize: '/authorize',
    Callback: '/callback',
};

const makeRequest = (options) => {
    return new Promise((resolve, reject) => {
        let body = '';

        const req = https.request(
            options,
            (res) => {
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(JSON.parse(body)));
            }
        )

        req.end();
    })
};

const requestHandler = async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    switch (url.pathname) {
        case ROUTES.Home: {
            const html = fs.readFileSync('./src/public/index.html')

            response.writeHeader(200, {'Content-Type': 'text/html'});
            response.write(html);
            response.end()

            break;
        }

        case ROUTES.Authorize: {
            response.statusCode = 302;
            response.setHeader('Location', `https://oauth.vk.com/authorize?client_id=${process.env.VK_OAUTH_CLIENT_ID}&redirect_uri=http://${host}:${port}/callback&display=popup&response_type=code`)
            response.end();

            break;
        }

        case ROUTES.Callback: {
            const {access_token} = await makeRequest({
                hostname: 'oauth.vk.com',
                path: `/access_token?scope=user&client_id=${process.env.VK_OAUTH_CLIENT_ID}&client_secret=${process.env.VK_OAUTH_CLIENT_SECRET}&code=${url.searchParams.get('code')}&redirect_uri=http://${host}:${port}${ROUTES.Callback}`,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                protocol: 'https:'
            });

            if (!access_token) {
                response.statusCode = 302;
                response.setHeader('Location', '/');
                response.end();

                return
            }

            const info = await makeRequest({
                hostname: 'api.vk.com',
                protocol: 'https:',
                path: `/method/users.get?access_token=${access_token}&v=5.126`,
                headers: {
                    'Accept': 'application/json; charset=utf-8'
                }
            })

            response.statusCode = 200;
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            response.write(`${info.response[0].first_name} ${info.response[0].last_name}`);
            response.end();
            break;
        }

        default:
            response.statusCode = 404;
            response.end('Not Found');
    }
}

const server = http.createServer(requestHandler);

server.listen(port, host, (err) => {
    if (err) {
        return console.log('Server is not started', err);
    }

    console.log(`Server is listening on ${host}:${port}`);
})