/**
 * Automatically inserts events into the database as they occur.
 * Currently tracks:
 *
 *   Users who have ever been seen in the room
 *   Each song that is played
 *   Each vote that occurs
 */

var PlugBotBase = require("plugbotbase");
var Event = PlugBotBase.Event;

var SqliteDao = require("../src/db/SqliteDao");

var LOG = new PlugBotBase.Log("DatabaseTracking");

var dao;

function init(globalObject) {
    dao = SqliteDao.getInstance(globalObject.config.Emancipator.databaseFile);
}

function handleAdvanceEvent(event, globalObject) {
    var newDj = {
        userID: event.incomingDJ.userID,
        username: event.incomingDJ.username
    };

    dao.upsertUser(newDj).then(function() {
        var play = {
            duration: event.media.durationInSeconds,
            playedOn: event.startDate,
            title: event.media.fullTitle,
            userID: event.incomingDJ.userID,
            videoID: event.media.contentID
        };

        dao.insertMediaPlay(play).then(function(insertPlayResult) {
            if (insertPlayResult.lastID) {
                // Store the primary key in the room state for tracking votes later
                globalObject.roomState.playHistory[0].emancipatorPlayID = insertPlayResult.lastID;
            }
            else {
                LOG.warn("No play ID available after inserting play: {}", insertPlayResult);
            }
        });
    });
}

function handleUserJoinEvent(event) {
    dao.upsertUser(event);
}

function handleVoteEvent(event, globalObject) {
    var currentSongPlayId = globalObject.roomState.playHistory[0].emancipatorPlayID;

    if (!currentSongPlayId) {
        LOG.warn("Unable to store vote ({}) in database because there is no current song play ID.", event);
        return;
    }

    dao.upsertMediaVote({
        playID: currentSongPlayId,
        userID: event.userID,
        vote: event.vote
    });
}

module.exports[Event.ADVANCE] = handleAdvanceEvent;
module.exports[Event.USER_JOIN] = handleUserJoinEvent;
module.exports[Event.VOTE] = handleVoteEvent;
module.exports.init = init;
