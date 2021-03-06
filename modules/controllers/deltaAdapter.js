require('dotenv').config();

const axios = require('axios');

const {mergeDailyActivitiesWithSleep, expandDaylyAvergeArray, mergeDailyActivities, mergeDateActivities, parseMilliseconds, studySleepPatterns} = require('@controllers/deltaUtils');

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
          if((info.data.twitch_info.streams && info.data.twitch_info.streams.length > 2)){
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
              },
              monitored: true
            };
          }else{
            return {
              twitchInfo: {
                displayName: `"-[${query}]-"`,
                loginName: `"-[${query}-]"`,
                followers: 0,
                description: "__",
                profilePicture: "https://visualpharm.com/assets/873/Nothing%20Found-595b40b65ba036ed117d20ae.svg"
              },
              twitterInfo: {
                loginName: `"-[${query}]-"`,
                description: "__",
                followers: 0,
                verified: "__"
              },
              monitored: false
            };
          }
        } catch (error) {
          throw error
        }
      }));
    }

    data.twitchResults = data.twitch_results.results;
    data.twitch_results = undefined;

    data.twitter_results = data.twitter_results.map((twitterUser) => {
      let oldUrl = twitterUser.profile_image;
      let newUrl = '';
      console.log(twitterUser.profile_image);
      if(oldUrl.indexOf('default_profile_normal.png') >= 0){
        newUrl = 'https://' + oldUrl.substring(7, oldUrl.length);
      }else{
        let extIndex = oldUrl.length - twitterUser.profile_image.split('').reverse().indexOf('.') - 1
        let normalIndex = oldUrl.indexOf('_normal.');
        newUrl = oldUrl.substring(0, normalIndex) + oldUrl.substring(extIndex, oldUrl.length);
      }
      console.log('--\n', newUrl);

      return {...twitterUser, profile_image: newUrl}
    })

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

    let streamStarts = expandDaylyAvergeArray(data.start_stream, 'startedAt', 'counts', 'streamStarts');

    let streamViewers = expandDaylyAvergeArray(data.hour, 'hour', 'viewers', 'viewers');

    let tweetSubmissions = expandDaylyAvergeArray(data.count_hour, 'hour', 'counts', 'tweetSubmissions');

    console.log('tweet submissions', tweetSubmissions);

    let dailyActivity = mergeDailyActivities(streamStarts, streamViewers, tweetSubmissions);

    let dateActivity = mergeDateActivities(data.date, data.like, data.count_date, data.words_twitch);

    let newSleepData = studySleepPatterns(dailyActivity);

    dailyActivity = mergeDailyActivitiesWithSleep(dailyActivity, newSleepData);

    data.start_stream = undefined;
    data.hour = undefined;
    data.count_hour = undefined;
    data.dailyActivity = dailyActivity;

    data.date = undefined;
    data.like = undefined;
    data.count_date = undefined;
    data.words_twitch = undefined;
    data.dateActivity = dateActivity;

    data.twitterFrequentWords = data.frequent_words_tweet;
    data.frequent_words_tweet = undefined;

    data.favoriteGames = data.favourite_games;
    data.favourite_games = undefined;

    data.dailyViewsPeak = Math.max(...data.dailyActivity.map((hour) => hour.streamViewers))
    data.dailyTweetPeak = Math.max(...data.dailyActivity.map((hour) => hour.tweetCounts))

    data.dailyAverageViewers = data.dailyActivity.reduce((acc, cv) => {
      return acc + cv.streamViewers;
    }, 0);
    data.dailyAverageViewers = Math.ceil(data.dailyAverageViewers / 24);

    data.dailyAverageTweets = data.dailyActivity.reduce((acc, cv) => {
      return acc + cv.tweetCounts;
    }, 0);

    data.dailyAverageTweets = Math.ceil(data.dailyAverageTweets / 24);

    data.dateLikesPeak = data.dateActivity.reduce((acc, cv) => {
      return (acc.likes < cv.likes) ? {date: cv.date, likes: cv.likes} : acc;
    }, {date: undefined, likes: 0})
    data.dateViewersPeak = data.dateActivity.reduce((acc, cv) => {
      return (acc.viewers < cv.viewers) ? {date: cv.date, viewers: cv.viewers} : acc;
    }, {date: undefined, viewers: 0})

    data.maxStreamStarts = data.dailyActivity.reduce((acc, cv) => {
      return (acc.streamStarts < cv.streamStarts) ? {hour: cv.hour, streamStarts: cv.streamStarts} : acc;
    }, {hour: 0, streamStarts: 0})

    if((data.dailyAverageViewers * 0.25) > data.dailyAverageTweets){
      data.dailyActivity = data.dailyActivity.map((day) => ({...day, enhancedTweetActivity: Math.ceil(day.tweetCounts * (data.dailyAverageViewers/data.dailyAverageTweets*0.2))}))
    }

    data.sleep = newSleepData;


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

    data.stream.msDuration = new Date(data.stream.tunits[data.stream.tunits.length-1].createdAt).getTime() - new Date(data.stream.startedAt).getTime()
    data.stream.duration = parseMilliseconds(data.stream.msDuration);
    data.stream.averageViewers = data.average_viewers;
    data.stream.totalNewFollowers = data.stream.tunits[data.stream.tunits.length-1].followers - data.stream.tunits[0].followers;

    data.average_viewers = undefined;

    data.streamEvents = data.stream_events;
    data.streamEvents.gameTunits = data.dur_game.map((game, idx) => {
      let start = (idx > 0) ? data.dur_game[idx-1].end.replace(' ', 'T').substring(0,23) + 'Z' : data.stream.startedAt;
      let end = game.end.replace(' ', 'T').substring(0,23) + 'Z';
      let msTunitLength = new Date(end).getTime() - new Date(start).getTime();

      return {
        gameName: game.gameName,
        start,
        end,
        msTunitLength,
        tunitLength: parseMilliseconds(msTunitLength)
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

    data.streamEvents.raids = data.streamEvents.raids.map((raid, idx) => {
      let msTimeStamp = new Date(raid.createdAt).getTime();

      return {...raid, msTimeStamp};
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

    return results.filter((res) => res.twitchInfo.displayName !== undefined);

  }catch (err){
    console.log(err);
    err.name = 400;
    throw err;
  }
  
}

const getMonitoredStreamers = async function () {

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/monitored`);
    let data = resp.data;

    let results = await Promise.all(data.monitored.map(async (streamer) => {
      try {
        const info = await axios.get(`${process.env.API_ENDPOINT}/${streamer.id_twitter}/info`)
        if(info.data.twitch_info){
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
            },
            enabled: (info.data.twitch_info && info.data.twitch_info.streams && info.data.twitch_info.streams.length > 2)
          };
        }else if(info.data.twitch_info){
          return {
            twitchInfo: {
              displayName: `"-[${info.data.twitter_info.screen_name}]-"`,
              loginName: `"-[${info.data.twitter_info.screen_name}-]"`,
              followers: 0,
              description: "__",
              profilePicture: "https://visualpharm.com/assets/873/Nothing%20Found-595b40b65ba036ed117d20ae.svg"
            },
            twitterInfo: {
              loginName: info.data.twitter_info.screen_name,
              description: info.data.twitter_info.description,
              followers: info.data.twitter_info.followers_count,
              verified: info.data.twitter_info.verified
            },
            enabled: false
          }
        }

      } catch (error) {
        throw error
      }
    }));

    return results.filter((res) => res !== null && res !== undefined);

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

const startMonitoring = async function (twitterId, twitchId, twitchName) {

  if(!twitchId || !twitterId || !twitchName){
    let err = new Error(`the fields are not properly defined`);
    err.name = 404;
    throw err; 
  }

  try{
    const resp = await axios.get(`${process.env.API_ENDPOINT}/startmonitoring?id_twitter=${twitterId}&id_twitch=${twitchId}&twitch_name=${twitchName}`);
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
exports.getMonitoredStreamers = getMonitoredStreamers;
exports.getFavorites = getFavorites;
exports.postFavorites = postFavorites;
exports.startMonitoring = startMonitoring;