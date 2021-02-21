require('dotenv').config();

const axios = require('axios');

const {getSleepArray, expandDaylyAvergeArray, mergeDailyActivities, mergeDateActivities} = require('@controllers/deltaUtils');

const search = async function (query) {

  if(!query){
    let err = new Error(`the fields are not properly defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/search?username=${query}`);
    let data = resp.data;

    if(data.monitored?.length > 0){
      data.monitored = await Promise.all(data.monitored.map(async (person) => {
        try {
          const info = await axios.get(`${process.env.API_ENDPOINT}/${person.id_twitter}/info`)
          return {
            twitchInfo: {
              displayName: info.data.twitch_info.displayName,
              loginName: info.data.twitch_info.loginName,
              followers: info.data.twitch_info.followers,
              description: info.data.twitch_info.description,
              profilePicture: info.data.twitch_info.profilePicture
            },
            twitterInfo: {
              loginName: info.data.twitter_info.screen_name,
              description: info.data.twitter_info.description,
              followers: info.data.twitter_info.followers_count,
              verified: info.data.twitter_info.verified
            }
          };
        } catch (error) {
          throw error
        }
      }));
    }

    data.twitchResults = data.twitch_results.results;
    data.twitch_results = undefined;

    return data;

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const userInfo = async function (id) {

  if(!id){
    let err = new Error(`the id is not defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/${id}/info`);
    let data = resp.data;

    data.twitchInfo = data.twitch_info;
    data.twitch_info = undefined;

    data.twitter_info.tweets = data.tweets;
    data.tweets = undefined;

    return data;
  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const userInsights = async function (id) {

  if(!id){
    let err = new Error(`the id is not defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/${id}/insights`);
    let data = resp.data;

    let sleepArray = getSleepArray(data.sleep);

    let streamStarts = expandDaylyAvergeArray(data.start_stream, 'startedAt', 'counts', 'streamStarts');

    let streamViewers = expandDaylyAvergeArray(data.hour, 'hour', 'viewers', 'viewers');

    let tweetSubmissions = expandDaylyAvergeArray(data.count_hour, 'hour', 'counts', 'tweetSubmissions');

    let dailyActivity = mergeDailyActivities(streamStarts, streamViewers, tweetSubmissions, sleepArray);

    let dateActivity = mergeDateActivities(data.date, data.like, data.count_date, data.words_twitch);

    data.start_stream = undefined;
    data.hour = undefined;
    data.sleep = undefined;
    data.count_hour = undefined;
    data.dailyActivity = dailyActivity;

    data.date = undefined;
    data.like = undefined;
    data.count_date = undefined;
    data.words_twitch = undefined;
    data.dateActivity = dateActivity;

    data.twitterFrequentWords = data.frequent_words_tweet;
    data.frequent_words_tweet = undefined;

    return data;
  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const streamData = async function (userId, streamId) {
  if(!userId){
    let err = new Error(`the user id is not defined`);
    err.name = 404;
    throw err; 
  }
  if(!streamId){
    let err = new Error(`the stream id is not defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/${userId}/${streamId}/details`);
    let data = resp.data;

    data.stream.tunits = data.stream.tunits.map((tunit, idx) => {
      let newFollowers = 0;
      if(idx > 0) {
        newFollowers = tunit.followers - data.stream.tunits[idx-1].followers;
      }

      return {...tunit, newFollowers, msTimeStamp: new Date(tunit.createdAt).getTime()}
    })

    data.stream.averageViewers = data.average_viewers;
    data.stream.totalNewFollowers = data.stream.tunits[data.stream.tunits.length-1].followers - data.stream.tunits[0].followers;

    data.average_viewers = undefined;

    data.streamEvents = data.stream_events;
    data.streamEvents.gameTunits = data.dur_game.map((game, idx) => {
      let start = (idx > 0) ? data.dur_game[idx-1].end.replace(' ', 'T').substring(0,23) + 'Z' : data.stream.startedAt;
      let end = game.end.replace(' ', 'T').substring(0,23) + 'Z';

      return {
        gameName: game.gameName,
        start,
        end,
        msTunitLength: new Date(end).getTime() - new Date(start).getTime()
      }
    })
    data.streamEvents.chatTunits = data.streamEvents.chatTunits.map((chatTunit, idx) => {
      let msTunitLenght = 0;
      let msTimeStamp = new Date(chatTunit.createdAt).getTime();

      if(idx === 0){
        msTunitLenght = msTimeStamp - new Date(data.stream.startedAt).getTime();
      }else{
        msTunitLenght = msTimeStamp - new Date(data.streamEvents.chatTunits[idx - 1].createdAt).getTime();
      }
      return {...chatTunit, msTimeStamp, msTunitLenght};
    });
    data.streamEvents.subPerHour = data.sub_hour;
    data.streamEvents.totalSubs = data.total_sub;
    data.streamEvents.meanMonthlySub = data.mean_month_sub;
    data.streamEvents.frequentWordsSub = data.frequent_words_sub;
    data.streamEvents.subscriptions = undefined;

    data.stream_events = undefined;
    data.sub_hour = undefined;
    data.dur_game = undefined;
    data.total_sub = undefined;
    data.mean_month_sub = undefined;
    data.frequent_words_sub = undefined;

    data.gameWithTitle = data.game_with_title;
    data.averageViewersPerGame = data.average_viewers_game;

    data.game_with_title = undefined;
    data.average_viewers_game = undefined;

    data.twitterData = {
      tweetBefore: data.tweet_before,
      tweetDuring: data.tweet_between,
      tweetAfter: data.tweet_after
    }

    data.tweet_before = undefined;
    data.tweet_between = undefined;
    data.tweet_after = undefined;

    return data;
  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }

}

const getTrendingStreamers = async function () {

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/trending`);
    let data = resp.data;

    let results = await Promise.all(data.trending.map(async (streamer) => {
      try {
        const info = await axios.get(`${process.env.API_ENDPOINT}/${streamer.id_twitter}/info`)
        return {
          twitchInfo: {
            displayName: info.data.twitch_info.displayName,
            loginName: info.data.twitch_info.loginName,
            followers: info.data.twitch_info.followers,
            description: info.data.twitch_info.description,
            profilePicture: info.data.twitch_info.profilePicture
          },
          twitterInfo: {
            loginName: info.data.twitter_info.screen_name,
            description: info.data.twitter_info.description,
            followers: info.data.twitter_info.followers_count,
            verified: info.data.twitter_info.verified
          }
        };
      } catch (error) {
        throw error
      }
    }));
 
    return results;

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const getFavorites = async function (googleToken) {

  if(!googleToken){
    let err = new Error(`the fields are not properly defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/favorites?token=${googleToken}`);
    let data = resp.data;

    let results = await Promise.all(data.twitter_favorites.map(async (id_twitter) => {
      try {
        const info = await axios.get(`${process.env.API_ENDPOINT}/${id_twitter}/info`)
        return {
          twitchInfo: {
            displayName: info.data.twitch_info.displayName,
            loginName: info.data.twitch_info.loginName,
            followers: info.data.twitch_info.followers,
            description: info.data.twitch_info.description,
            profilePicture: info.data.twitch_info.profilePicture
          },
          twitterInfo: {
            loginName: info.data.twitter_info.screen_name,
            description: info.data.twitter_info.description,
            followers: info.data.twitter_info.followers_count,
            verified: info.data.twitter_info.verified
          }
        };
      } catch (error) {
        throw error
      }
    }));
 
    return results;

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const postFavorites = async function (googleToken, twitterId, twitchId) {

  if(!googleToken || !twitchId || !twitterId){
    let err = new Error(`the fields are not properly defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.post(`${process.env.API_ENDPOINT}/favorites`, {token: googleToken, id_twitter: twitterId, id_twitch: twitchId});
    let data = resp.data;

    return data;

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const startmonitoring = async function (twitterId, twitchId) {

  if(!twitchId || !twitterId){
    let err = new Error(`the fields are not properly defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/startmonitoring?id_twitter=${twitterId}&id_twitch=${twitchId}`);
    let data = resp.data;

    return data;

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

exports.search = search;
exports.userInfo = userInfo;
exports.userInsights = userInsights;
exports.streamData = streamData;
exports.getTrendingStreamers = getTrendingStreamers;
exports.getFavorites = getFavorites;
exports.postFavorites = postFavorites;
exports.startmonitoring = startmonitoring;