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

const mergeDailyActivitiesWithSleep = function (dailyActivity, sleepData) {

  let startSleep = parseInt(sleepData.start.substring(0,2));
  let endSleep = parseInt(sleepData.end.substring(0,2));

  let mergedData = dailyActivity.map((activity,i) => ({...activity, sleeping: ((startSleep < endSleep) ? (i >= startSleep && i <= endSleep) : (i >= startSleep || i <= endSleep)) }))
  return mergedData;
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

const mergeDailyActivities = function (streamStarts, streamViewers, tweetSubmissions) {

  let mergedData = streamStarts.map((start, idx) => ({
    hour: start.hour, 
    streamStarts: start.streamStarts, 
    streamViewers: streamViewers[idx].viewers,
    tweetCounts: tweetSubmissions[idx].tweetSubmissions
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

const parseMilliseconds = function (ms) {
  const hours = Math.floor(ms / (1000*60*60));
  const minutes = Math.floor((ms - (hours * (1000*60*60))) / (1000 * 60));
  const seconds = Math.floor((ms - ((hours * (1000*60*60)) + (minutes * (1000 * 60)))) / 1000);

  return `${(hours < 10) ? '0' + hours : hours}:${(minutes < 10) ? '0' + minutes : minutes}:${(seconds < 10) ? '0' + seconds : seconds}.000`;
}

function hourDiff(hour1, hour2) {
  
}

const studySleepPatterns = function (dailyActivity) {
  //consolx.log(dailyActivity)

  const activity = dailyActivity.map((hour) => ({hour: hour.hour, total: (hour.tweetCounts + hour.streamViewers + hour.streamStarts)}));

  //const sortedActivity = activity.sort((ac1, ac2) => ac1.total - ac2.total);
  //console.log(sortedActivity);

  //const leastActiveHours = sortedActivity.slice(0,4);
  //console.log(leastActiveHours);

  let sleepHours = 1;
  let toggleRL = true;
  let minHour = activity.reduce((acc, cv) => {
    return (acc.total > cv.total) ? {hour: cv.hour, total: cv.total} : acc;
  }, {hour: undefined, total: 100000})

  //consolx.log(minHour);

  let rightIdx = activity[minHour.hour].hour; let impossibleRightJump = false;
  let leftIdx = activity[minHour.hour].hour; let impossibleLeftJump = false;
  let minActivity = (activity[minHour.hour].total > 15) ? activity[minHour.hour].total : 15;

  while (sleepHours < 8 && (!impossibleRightJump || !impossibleLeftJump)) {
    //consolx.log('CYCLE\n#################STATUS:\n', `leftIdx: ${leftIdx} | rightIdx: ${rightIdx} | sleepHours: ${sleepHours} | canGoR: ${!impossibleRightJump} | canGoL: ${!impossibleLeftJump}`);

    let jump = 1;

    if(toggleRL){ //go right
      //consolx.log('going right!');

      let newRightIdx = rightIdx;
      minActivity = (activity[rightIdx].total > 15) ? activity[rightIdx].total : 15;

      while (jump < 4) {
        let minActivityJump = minActivity + minActivity * 0.15;
        let i = (rightIdx + jump) % 24;
        //consolx.log('Jumping R: ' + i, `newAct: ${activity[i].total} | maxJump: ${minActivityJump}`);

        if(activity[i].total <= minActivityJump){
          //consolx.log('Can jump to next sleeping hour!');
          minActivity = (activity[i].total > 15) ? activity[i].total : 15;
          //consolx.log(`newMinAct: ${minActivity}`);
          newRightIdx = i;
          sleepHours++;
        }else{
          //consolx.log('Can\'t jump to next sleeping hour!');
        }

        jump++;
      }

      if(newRightIdx === rightIdx){
        impossibleRightJump = true;
        //consolx.log('It\'s impossible to keep jumping right')
      }else{
        rightIdx = newRightIdx;
      }
    
    }else{ //left
      //consolx.log('going left!')

      let newLeftIdx = leftIdx;
      minActivity = (activity[leftIdx].total > 15) ? activity[leftIdx].total : 15;

      while (jump < 4) {
        let minActivityJump = minActivity + minActivity * 0.15;
        let i = ((leftIdx - jump) >= 0) ? (leftIdx - jump) : (24 + (leftIdx - jump));
        //consolx.log('Jumping L: ' + i, `newAct: ${activity[i].total} | maxJump: ${minActivityJump}`);

        if(activity[i].total <= minActivityJump){
          //consolx.log('Can jump to next sleeping hour!');
          minActivity = (activity[i].total > 15) ? activity[i].total : 15;
          //consolx.log(`newMinAct: ${minActivity}`);
          newLeftIdx = i;
          sleepHours++;
        }else{
          //consolx.log('Can\'t jump to next sleeping hour!');
        }

        jump++;
      }

      if(newLeftIdx === leftIdx){
        impossibleLeftJump = true;
        //consolx.log('It\'s impossible to keep jumping left')
      }else{
        leftIdx = newLeftIdx;
      }
    }

    toggleRL = !toggleRL;

  }

  //consolx.log(`obtained the following range L:${leftIdx} - R:${rightIdx}`);

  let totalSleep = (rightIdx > leftIdx) ? rightIdx - leftIdx + 1 : rightIdx + (24 - leftIdx) + 1;

  return {start: leftIdx+':00:00', end: rightIdx+':00:00', totalSleep};
}

exports.getSleepArray = getSleepArray;
exports.expandDaylyAvergeArray = expandDaylyAvergeArray;
exports.mergeDailyActivities = mergeDailyActivities;
exports.mergeDateActivities = mergeDateActivities;
exports.parseMilliseconds = parseMilliseconds;
exports.studySleepPatterns = studySleepPatterns;
exports.mergeDailyActivitiesWithSleep = mergeDailyActivitiesWithSleep;