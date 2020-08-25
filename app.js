const express = require("express");
const session = require("express-session");

const redis = require('redis')
 
let RedisStore = require('connect-redis')(session)
let redisClient = redis.createClient(); // run redis locally using docker

// docker run -p 6379:6379 --name test-redis -d redis
// docker exec -it <container_id> redis-cli
// scan 0 

// the scan above starts from 0 and lists all sessions

redisClient.on('connect', function() {
    console.log('Redis client connected');
});

redisClient.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

const TWO_HOURS = 1000 * 60 * 60 * 2;

const {
    PORT=3000,
    SESSION_LIFETIME= TWO_HOURS,
    NODE_ENV='development',
    SESSION_NAME='sid',
    SECRET='secret',
} = process.env;

const IN_PROD = NODE_ENV === "production";
const users = [
    {
        id: 1, name: 'alex', email: 'alex@mail.com', password: 'secret'
    },
    {
        id: 2, name: 'sam', email: 'sam@mail.com', password: 'secret'
    },
    {
        id: 3, name: 'max', email: 'max@mail.com', password: 'secret'
    }
]

const app = express();
app.use(express.json());
app.use(express.urlencoded());

app.use(session({
    name: SESSION_NAME,
    store: new RedisStore({ client: redisClient }),
    resave: false,
    saveUninitialized: false,
    secret: SECRET,
    cookie: {
        maxAge: SESSION_LIFETIME,
        sameSite: true,
        secure: IN_PROD 
    }
}));

app.use((req, res, next) => {
    const { userId } = req.session;
    if(userId){
        res.locals.user  = users.find(user => user.id === req.session.userId);
    }
    next();
})

const redirectLogin = (req, res, next) => {
    if(!req.session.userId){
        // session is uninitialised and not in session store
        // not authenticated
        res.redirect('/login')
    }else{
        next()
    }
}

const redirectHome = (req, res, next) => {
    if(req.session.userId){
        // session is uninitialised and not in session store
        // not authenticated
        res.redirect('/home')
    }else{
        next()
    }
}


app.get("/", (req, res) => {
    const {userId} = req.session;

    res.send(`
        <h1> Welcome </h1>
        ${userId ? `
        <a href='/home'>home</a>
        <form method='post' action='/logout'>
            <button>logout</button>
        </form>`
        : 
        `<a href='/login'>login</a>
        <a href='/register'>register</a>
        `
    }
    `)
});

app.get("/home", redirectLogin ,(req, res) => {
    console.log(req.sessionID);

    redisClient.keys("sess:*", function(error, keys){
        console.log("Number of active sessions: ", keys.length);
    });

    const { user } = res.locals;
    res.send(`
    <h1> Home</h1>
    <a href='/'> Main </a>
    <ul>
    <li>Name: ${user.name}</li>
    <li>Email: ${user.email}</li>
    </ul>
    `);
});

app.get("/login", redirectHome, (req, res) => {
    res.send(`
    <h1>Login</h1>
    <form method='post' action='/login'>
            <input type='email' name='email' placeholder='email' required />
            <input type='password' name='password' placeholder='password' required />
            <input type='submit'  />
        </form>

        <a href='/register'> Register </a>
    `);
});

app.get("/register", redirectHome, (req, res) => {
    res.send(`
    <h1>Register</h1>
    <form method='post' action='/register'>
            <input type='name' name='name' placeholder='name' require />
            <input type='email' name='email' placeholder='email' require />
            <input type='password' name='password' placeholder='password' require />
            <input type='submit'  />
        </form>

        <a href='/login'> Login </a>
    `);
});

app.post("/login", redirectHome, (req, res) => {
    const { email, password } = req.body;

    if(email && password){
        const user = users.find((user)=> user.email === email && user.password === password); // compare hashes in real life
        if(user){
            req.session.userId = user.id;
            return res.redirect('/home'); // if auth then session id cookie and go to home route
        }

        res.redirect('/login')
    }
});

app.post("/register", redirectHome, (req, res) => {
    const { email, password, name } = req.body;

    if(email && password && name){
        const exists = users.some((user)=> user.email === email);
        if(!exists){
            const user = {
                id: users.length + 1,
                name, 
                email, 
                password // hash in real life
            }
            users.push(user);

            req.session.userId = user.id;

            return res.redirect('/home')
        }
    }

    res.redirect('/register')
});

app.post("/logout", redirectLogin, (req, res) => {
   req.session.destroy((err) => {
       if(err){
           return res.redirect('/home')
       }

       res.clearCookie(SESSION_NAME); // clear cookie
       res.redirect('/login');
   }); 
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});