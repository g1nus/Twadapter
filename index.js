require('module-alias/register');
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const deltaAdapt = require('@controllers/deltaAdapter');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const router = express.Router();

//middleware for checking permissions of all requests
router.use((req, res, next) => {
  console.log(req.url);

  res.header("Access-Control-Allow-Origin", req.headers.origin);
  //enable the cookie sending
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Accept, Cache-Control, Content-Type, Authorization');

  if (req.method === "OPTIONS") {
      res.sendStatus(200);
  }
  else {
    next();
  }
});

router.get('/', async (req, res, next) => {
  res.json({msg: "/"})
})

router.get('/search', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.search(req.query.query);
    res.json(resp);

  }catch (err){
    err.name = 400;
    return next(err);
  }
})

router.get('/users/:id', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.userInfo(req.params.id);

    res.json(resp);

  }catch (err){
    return next(err);
  }
})

router.get('/users/:id/insights', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.userInsights(req.params.id);

    res.json(resp);

  }catch (err){
    return next(err);
  }
})

router.get('/users/:u_id/streams/:s_id', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.streamData(req.params.u_id, req.params.s_id);

    res.json(resp);

  }catch (err){
    return next(err);
  }
})

router.get('/trending', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.getTrendingStreamers();
    res.json(resp);

  }catch (err){
    err.name = 400;
    return next(err);
  }
})

router.get('/favorites', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.getFavorites(req.query.g_token);
    res.json(resp);

  }catch (err){
    err.name = 400;
    return next(err);
  }
})

router.get('/monitored', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.getMonitoredStreamers();
    res.json(resp);

  }catch (err){
    err.name = 400;
    return next(err);
  }
})

router.post('/favorites', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.postFavorites(req.body.g_token, req.body.twitterId, req.body.twitchId);
    res.json({msg: "done"});

  }catch (err){
    err.name = 400;
    return next(err);
  }
});

router.post('/monitor', async (req, res, next) => {
  try{
    let resp = await deltaAdapt.startMonitoring(req.body.twitterId, req.body.twitchId, req.body.twitchName);
    res.json(resp);

  }catch (err){
    err.name = 400;
    return next(err);
  }
});

app.use('/', router)

//last middleware for sending error
app.use((err, req, res, next) => {
  //console.error('[Error]', err);
  if(err.response?.data?.message){
    res.status(err.name).json({error: err.response.data.message});
  }else{
    res.status(err.name).json({error: err.message});
  }
});



app.listen(process.env.PORT, () => {
  console.log(`Example app listening at http://localhost:${process.env.PORT}`)
})