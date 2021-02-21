const getSleepArray = function (sleepString) {
  let startSleep = parseInt(sleepString.substring(0,2));
  let endSleep = parseInt(sleepString.substring(9,11));
  let sleepArray = undefined;

  //sleeping hours mangaement
  if(startSleep < endSleep){
    sleepArray = Array.from({length: 24}, (_, i) => ({hour: i, sleep: (i >= startSleep && i <= endSleep)}));
  }else{
    sleepArray = Array.from({length: 24}, (_, i) => ({hour: i, sleep: (i >= startSleep || i <= endSleep)}));
  }

  return sleepArray;
}

const expandDaylyAvergeArray = function (list, hourTag, countTag, newTag) {

  if(list.length === 0){
    let newObj = {};
    newObj[hourTag] = '23:00:00';
    newObj[countTag] = 0;
    list.push(newObj);
  }

  let hourlyList = list.reduce((acc, cv, idx) => {
    const currentHour = parseInt(cv[hourTag].substring(0,2));
    if(idx > 0){
      const previousHour = parseInt(list[idx-1][hourTag].substring(0,2));
      const diff = currentHour - previousHour
      if(diff > 1){
        let startHour = previousHour;
        let expansion = Array.from({length: diff - 1}, (_, i) => {
          let newObj = {};
          newObj['hour'] = startHour + i + 1;
          newObj[newTag] = 0;
          return newObj;
        })
        let newObj = {};
        newObj['hour'] = currentHour;
        newObj[newTag] = cv[countTag];
        expansion.push(newObj);
        acc.push(expansion)
      }else{
        let newObj = {};
        newObj['hour'] = currentHour;
        newObj[newTag] = cv[countTag];
        acc.push(newObj)
      }
    }else{
      if(currentHour !== 0){
        let expansion = Array.from({length: currentHour}, (_, i) => {
          let newObj = {};
          newObj['hour'] = i;
          newObj[newTag] = 0;
          return newObj;
        })
        let newObj = {};
        newObj['hour'] = currentHour;
        newObj[newTag] = cv[countTag];
        expansion.push(newObj);
        acc.push(expansion);
      }else{
        let newObj = {};
        newObj['hour'] = currentHour;
        newObj[newTag] = cv[countTag];
        acc.push(newObj);
      }
    }
    return acc;
  }, []);

  hourlyList = hourlyList.flat();
  if(hourlyList[hourlyList.length - 1]['hour'] < 23){
    let finishHour = hourlyList[hourlyList.length - 1]['hour'];
    hourlyList.push(...Array.from({length: 23-finishHour}, (_, i) => {
      let newObj = {};
      newObj['hour'] = finishHour + i + 1;
      newObj[newTag] = 0;
      return newObj;
    }))
    
  }

  return hourlyList;
}

const mergeDailyActivities = function (streamStarts, streamViewers, tweetSubmissions, sleepArray) {

  let mergedData = streamStarts.map((start, idx) => ({
    hour: start.hour, 
    streamStarts: start.streamStarts, 
    streamViewers: streamViewers[idx].viewers,
    tweetCounts: tweetSubmissions[idx].tweetSubmissions,
    sleeping: sleepArray[idx].sleep
  }))

  return mergedData;
}

const mergeDateActivities = function (viewersPerDate, likesPerDate, tweetsPerDate, twitchWordsDates){
  let mergedData = viewersPerDate.map((day) => {
    let likes = likesPerDate.find((el) => el.date === day.date);
    let tweets = tweetsPerDate.find((el) => el.date === day.date);
    let twitchWords = twitchWordsDates?.find((el) => el === day.date);
    
    return {
      date: day.date,
      viewers: day.viewers,
      likes: (likes) ? likes.like : 0,
      retweets: (likes) ? likes.retweet : 0,
      tweets: (tweets) ? tweets.counts : 0,
      twitchMention: (twitchWords) ? true : false
    }
  });

  return mergedData;
}

exports.getSleepArray = getSleepArray;
exports.expandDaylyAvergeArray = expandDaylyAvergeArray;
exports.mergeDailyActivities = mergeDailyActivities;
exports.mergeDateActivities = mergeDateActivities;