var API_KEY_QS = "api_key=0f88c954-c287-4699-956c-e7504010f72a"
var REGION = "na"
var CHAMPS_PER_SUMMONER = 5
var BASE_URL = "https://" + REGION + ".api.pvp.net/api/lol/" + REGION + "/"

function listToCommaString(list) {
	var commaString = ""
	for (i = 0; i < 5; i++) {
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
	     + "?champData=image,tags&"
	     + API_KEY_QS
}

function constructHistoryApiUrl(summonerId, champIds) {
	return BASE_URL 
	     + "v2.2/matchhistory/" + summonerId
	     + "?championIds=" + champIds
	     + "&rankedQueues=RANKED_SOLO_5x5&beginIndex=0&endIndex=15&"
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
		case "middle":
			return 2;
		case "top":
			return 0;
		case "support":
			return 4;
		case "adc":
			return 3;
		case "jungle":
			return 1;
	}
}

function printTeam(teamObj) {
	var teamString = ""
	teamObj.team = _.sortBy(teamObj.team, roleSortingValue)
	for (i = 0; i < 5; i++) {
		var champ = teamObj.team[i]
		teamString +=
			champ.summoner + 
			" plays <img class=\"champImg\" src=\"" + constructChampImgUrl(champ.image) + "\">" + 
			" " + champ.role +
			"<br />"
	}
	return teamString
}

function getStatsForPlayers(summonerNames) {
	/*
	var dfd = new jQuery.Deferred()

	$.get(constructSummonerApiUrl(summonerNames), function(data) {
		dfd.resolve(data)
	}) //GET summoner objects
	*/

	//Summoners object hardcoded to get around API limit
	var summoners = {"cowcurler":{"id":31252802,"name":"Cowcurler","profileIconId":588,"summonerLevel":30,"revisionDate":1431399790000},"stealthpoop":{"id":31500123,"name":"Stealthpoop","profileIconId":772,"summonerLevel":30,"revisionDate":1434358184000},"eulersidentity":{"id":36698943,"name":"Eulers Identity","profileIconId":539,"summonerLevel":30,"revisionDate":1434427672000},"potateo":{"id":34621554,"name":"poTATEo","profileIconId":663,"summonerLevel":30,"revisionDate":1434145661000},"imajineshion":{"id":39593946,"name":"Imajineshion","profileIconId":785,"summonerLevel":30,"revisionDate":1433310655000}}
	var getBestChamps = function(summoners) {
		var summonerIds = _.map(_.values(summoners), function(dto) { 
			return dto.id 
		})

		var summonerNames = _.map(_.values(summoners), function(dto) { 
			return dto.name 
		})

		var nameTable = _.object(summonerIds, summonerNames)

		var bestChamps = _.object(summonerNames, [[], [], [], [], []])

		var totalCount = summonerIds.length * CHAMPS_PER_SUMMONER

		var summonerCount = summonerIds.length

		for (i = 0; i < summonerIds.length; i++) {
			$.get(constructStatsApiUrl(summonerIds[i]), function(data) {
				var rankedStats = _.sortBy(data.champions, function(champ) {
					return -championScore(champ)
				})
				var champCount = CHAMPS_PER_SUMMONER
				for (j = 1; j < CHAMPS_PER_SUMMONER + 1; j++) {
						var url = constructChampApiUrl(rankedStats[j].id);
						(function(k) {
							$.get(url, function(champ) {
								bestChamps[nameTable[data.summonerId]].push({id: champ.id, 
																  name: champ.name,
																  tags: champ.tags,
																  score: championScore(rankedStats[k]),
																  image: champ.image.full,
																  roles: []})
								totalCount--
								champCount--
								if (champCount == 0) {
									var champIds = listToCommaString(_.pluck(bestChamps[nameTable[data.summonerId]], "id"))
									var historyUrl = constructHistoryApiUrl(data.summonerId, champIds)
									$.get(historyUrl, function(history) {
										_.each(history.matches, function(match, ind, l) {
											var lane = match.participants[0].timeline.lane
											var champObj = _.findWhere(bestChamps[nameTable[data.summonerId]], {id: match.participants[0].championId})
											var role = lane != "BOT" && lane != "BOTTOM" ? lane.toLowerCase() :
													   match.participants[0].timeline.role == "DUO_CARRY" ? "adc" : "support"
											if (!_.contains(champObj.roles, role)) champObj.roles.push(role)
										})
										summonerCount--
										if (summonerCount == 0) {
											var bestTeam = createTeamComp(bestChamps)
											$("#recommendedChamps").html(printTeam(bestTeam))
										}
									})
								}
							})
						})(j)
				}
			}) //GET ranked stats for id
		}

	}

	//$.when(dfd).then(getBestChamps)
	getBestChamps(summoners)

}

var addChamp = function(rolesLeft, summonersLeft, totalScore, team, bestChamps) {
	if (rolesLeft.length == 0) return {team: team, score: totalScore}
	var summoner = summonersLeft.pop()
	var champs = bestChamps[summoner]
	var bestTeams = []
	for (i = 0; i < CHAMPS_PER_SUMMONER; i++) {
		var champ = champs[i]
		var summonerName = summoner
		var roles = _.intersection(champ.roles, rolesLeft)
		if (roles.length == 0) continue
		var possibleTeams = _.map(roles, function(role) {
			var newRolesLeft = rolesLeft.slice(0)
			newRolesLeft.splice(newRolesLeft.indexOf(role), 1)
			var newTeam = team.slice(0)
			newTeam.push({name: champ.name, role: role, image: champ.image, summoner: summonerName})
			return addChamp(newRolesLeft, 
				     		summonersLeft.slice(0), 
				 			champ.score + totalScore,
				     		newTeam,
				     		bestChamps)
		})
		bestTeams.push(_.max(possibleTeams, function(obj) {
			return obj.score
		}))
	}
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
	/*
	Hardcoded testing values
	$("#p1id_txt").val("Imajineshion")
	$("#p2id_txt").val("poTATEo")
	$("#p3id_txt").val("Cowcurler")
	$("#p4id_txt").val("Eulers Identity")
	$("#p5id_txt").val("Stealthpoop")
	*/
	$("#submit_btn").click(function() {
		var summonerNames = ""
		for (i = 1; i < 6; i++) {
			var sn = $("#p" + i.toString() + "id_txt").val()
			if (sn === "") continue
			if (i != 1) summonerNames += ","
			summonerNames += sn
		}
		getStatsForPlayers(summonerNames)
	})
})