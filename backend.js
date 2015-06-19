var API_KEY_QS = "api_key=99bad429-1842-4b8c-8264-cff3289b807c"
var NUM_MATCHHISTORY_CALLS = 2
var REGION = "na"
var CHAMPS_PER_SUMMONER = 10
var BASE_URL = "https://" + REGION + ".api.pvp.net/api/lol/" + REGION + "/"

function listToCommaString(list) {
	var commaString = ""
	for (i = 0; i < list.length; i++) {
		var itemString = list[i]
		if (itemString === "") continue
		if (i != 0) commaString += ","
		commaString += itemString
	}
	return commaString
}

function constructSummonerApiUrl(names) {
	return BASE_URL
	     + "v1.4/summoner/by-name/" 
	     + names 
	     + "?"
	     + API_KEY_QS
}

function constructStatsApiUrl(summonerId) {
	return BASE_URL
		 + "v1.3/stats/by-summoner/"
		 + summonerId 
		 + "/ranked?"
		 + API_KEY_QS
}

function constructChampApiUrl(champId) {
	return "https://global.api.pvp.net/api/lol/static-data/"
	     + REGION + "/v1.2/champion/"
	     + champId
	     + "?champData=image&"
	     + API_KEY_QS
}

function constructHistoryApiUrl(summonerId, champIds, ind) {
	return BASE_URL 
	     + "v2.2/matchhistory/" + summonerId
	     + "?championIds=" + champIds
	     + "&rankedQueues=RANKED_SOLO_5x5&beginIndex=" + ind.toString() + "&endIndex=" + (ind + 15).toString() + "&"
	     + API_KEY_QS
}

function constructChampImgUrl(filename) {
	return "http://ddragon.leagueoflegends.com/cdn/4.4.3/img/champion/" + filename
}

function championScore(champ) {
	return champ.stats.totalSessionsPlayed
}

var roleSortingValue = function(champ) {
	switch(champ.role) {
		case "top":
			return 0;
		case "jungle":
			return 1;
		case "middle":
			return 2;
		case "adc":
			return 3;
		case "support":
			return 4;
	}
}

function printTeam(teamObj) {
	var teamString = ""
	teamObj.team = _.sortBy(teamObj.team, roleSortingValue)
	for (i = 0; i < 5; i++) {
		var champ = teamObj.team[i]
		teamString +=
			champ.summoner + 
			" plays <img alt=\"" + champ.name + "\" class=\"champImg\" src=\"" + constructChampImgUrl(champ.image) + "\">" + 
			" " + champ.role +
			"<br />"
	}
	return teamString
}

function getStatsForPlayers(summonerNames) {
	
	var dfd = new jQuery.Deferred()

	$.get(constructSummonerApiUrl(summonerNames), function(data) {
		dfd.resolve(data)
	}) //GET summoner objects

	var getBestChamps = function(summoners) {
		var summonerIds = _.map(_.values(summoners), function(dto) { 
			return dto.id 
		})

		var summonerNames = _.map(_.values(summoners), function(dto) { 
			return dto.name 
		})

		var nameTable = _.object(summonerIds, summonerNames)

		var bestChamps = _.object(summonerNames, [[], [], [], [], []])
		
		var statsReqs = []

		var historyReqs = []

		var historyCount = 5 * NUM_MATCHHISTORY_CALLS

		var roleTotal = 0

		for (i = 0; i < summonerIds.length; i++) {
			statsReqs.push($.get(constructStatsApiUrl(summonerIds[i]), function(data) {
				var rankedStats = _.sortBy(data.champions, function(champ) {
					return -championScore(champ)
				})
				var champReqs = []
				for (j = 1; j < Math.min(CHAMPS_PER_SUMMONER + 1, rankedStats.length); j++) {
						var champUrl = constructChampApiUrl(rankedStats[j].id);
						(function(k) {
							champReqs.push($.get(champUrl, function(champ) {
								bestChamps[nameTable[data.summonerId]].push({id: champ.id, 
																  name: champ.name,
																  score: championScore(rankedStats[k]),
																  image: champ.image.full,
																  roles: {}})
							}))
						})(j)
				}
				$.when.apply($, champReqs).done(function() {
					console.log("Finished looking up champs for summoner " + nameTable[data.summonerId])
					var champIds = listToCommaString(_.pluck(bestChamps[nameTable[data.summonerId]], "id"))
					var loadHistoryData = function(history) {
						historyCount--
						_.each(history.matches, function(match, ind, l) {
							var lane = match.participants[0].timeline.lane
							var champObj = _.findWhere(bestChamps[nameTable[data.summonerId]], {id: match.participants[0].championId})
							var role = lane != "BOT" && lane != "BOTTOM" ? lane.toLowerCase() :
									   match.participants[0].timeline.role == "DUO_CARRY" ? "adc" : "support"
							if (!champObj.roles[role]) {
								champObj.roles[role] = 1
							} else {
								champObj.roles[role]++
							}
						})
						if (historyCount == 0) {
							var bestTeam = createTeamComp(bestChamps)
							$("#recommendedChamps").html(printTeam(bestTeam))
						}
					}
					for (a = 0; a < NUM_MATCHHISTORY_CALLS; a++) {
						historyReqs.push($.get(constructHistoryApiUrl(data.summonerId, champIds, a), loadHistoryData))
					}
				})
			})) //GET ranked stats for id
		}
		$.when.apply($, statsReqs).done(function() {
			console.log("retrieved all stats")
			$.when.apply($, historyReqs).done(function() {
				
			})
		})
	}

	$.when(dfd).then(getBestChamps)

}

var addChamp = function(rolesLeft, summonersLeft, totalScore, team, bestChamps) {
	if (rolesLeft.length == 0) return {team: team, score: totalScore}
	var summoner = summonersLeft.pop()
	var champs = bestChamps[summoner]
	var bestTeams = []
	_.each(champs, function(champ, ind, l) {
		if (_.findWhere(team, {name: champ.name})) { return }
		var summonerName = summoner
		var roles = _.intersection(_.keys(champ.roles), rolesLeft)
		if (roles.length == 0) { return }
		var possibleTeams = []
		_.each(roles, function(role, ind2, l2) {
			var newRolesLeft = rolesLeft.slice(0)
			newRolesLeft.splice(newRolesLeft.indexOf(role), 1)
			var newTeam = team.slice(0)
			newTeam.push({name: champ.name, role: role, image: champ.image, summoner: summonerName})
			var tm = addChamp(newRolesLeft, 
				       		  summonersLeft.slice(0), 
				 			  (champ.roles[role] * champ.score) + totalScore,
				     		  newTeam,
				     		  bestChamps)
			if (tm) { possibleTeams.push(tm) }
		})
		if (possibleTeams.length != 0) {
			bestTeams.push(_.max(possibleTeams, function(obj) {
				return obj.score
			}))
		}
	})
	if (bestTeams.length == 0) { return null }
	var bestTeam = _.max(bestTeams, function(obj) {
		return obj.score
	})
	return bestTeam
}

var createTeamComp = function(bestChamps) {
	return addChamp(["middle","top","jungle","adc","support"], 
		             _.keys(bestChamps), 
		             0, 
		             [], 
		             bestChamps)
}

$(document).ready(function() {
	
	//Hardcoded testing values
	/*
	$("#p1id_txt").val("Imajineshion")
	$("#p2id_txt").val("C9 Sneaky")
	$("#p3id_txt").val("Potateo")
	$("#p4id_txt").val("Doublelift")
	$("#p5id_txt").val("imaqtpie")
	*/
	
	$("#submit_btn").click(function() {
		var summonerNames = ""
		var names = []
		for (i = 1; i < 6; i++) {
			var sn = $("#p" + i.toString() + "id_txt").val()
			if (sn === "") continue
			if (names.indexOf(sn) >= 0) {
				console.log("Error: duplicate summoner name entered. Exiting...")
				return
			}
			if (i != 1) summonerNames += ","
			summonerNames += sn
			names.push(sn)
		}
		getStatsForPlayers(summonerNames)
	})
})