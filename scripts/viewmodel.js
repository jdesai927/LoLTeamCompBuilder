var API_KEY_QS = "api_key=99bad429-1842-4b8c-8264-cff3289b807c"
var NUM_MATCHHISTORY_CALLS = 1
var REGIONS_URL = "http://status.leagueoflegends.com/shards"
var REGION = null
var CHAMPS_PER_SUMMONER = 10

var champWallpapers = ["../res/img/braum.jpg", "../res/img/orianna.jpg", "../res/img/baron.jpg"]

function makeBaseUrl() {
	return "https://" + REGION + ".api.pvp.net/api/lol/" + REGION + "/"
}

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
	return makeBaseUrl()
	     + "v1.4/summoner/by-name/" 
	     + names 
	     + "?"
	     + API_KEY_QS
}

function constructStatsApiUrl(summonerId) {
	return makeBaseUrl()
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
	return makeBaseUrl()
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

var addChamp = function(rolesLeft, summonersLeft, totalScore, team, bestChamps, oldTeam) {
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
			if (_.findWhere(oldTeam, {role: champ.role, name: champ.name, summoner: summonerName})) { return }
			var newRolesLeft = rolesLeft.slice(0)
			newRolesLeft.splice(newRolesLeft.indexOf(role), 1)
			var newTeam = team.slice(0)
			var champDisplay = {name: champ.name, role: role, image: champ.image, summoner: summonerName}
			newTeam.push(champDisplay)
			var tm = addChamp(newRolesLeft, 
				       		  summonersLeft.slice(0), 
				 			  (champ.roles[role] * champ.score) + totalScore,
				     		  newTeam,
				     		  bestChamps,
				     		  oldTeam)
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

var createTeamComp = function(bestChamps, oldTeam) {
	return addChamp(["middle","top","jungle","adc","support"], 
		             _.keys(bestChamps), 
		             0, 
		             [], 
		             bestChamps,
		             oldTeam)
}

function TeamCompBuilderViewModel() {
	var self = this

	self.summoners = ko.observableArray([{name: "Imajineshion"},
					  					 {name: "Imaqtpie"},
					  					 {name: "poTATEo"},
					  					 {name: "Doublelift"},
					  					 {name: "C9 Sneaky"}])

	self.bestTeam = ko.observableArray([])

	self.regions = ko.observableArray(["NA",
									   "EUW",
									   "EUNE",
									   "KR",
									   "OCE",
									   "LAN",
									   "LAS",
									   "BR",
									   "TR",
									   "RU"])

	self.selectedRegion = ko.observable()

	$(".recommendedTeam").click(function() {
		console.log("Team clicked!")
	})
	
	self.currentPanel = ko.observable("#regionPanel")

	self.showPanel = function(panel, img) {
		$(self.currentPanel()).toggle("slide", {direction: 'left'}, function() {
			$(panel).toggle("slide", {direction: 'right'})
			$('.bluebg').fadeTo('slow', 0.3, function()
			{
    			$(this).css('background-image', 'url(' + img + ')');
			}).fadeTo('slow', 1)
			self.currentPanel(panel)	
		})
	}

	self.setRegion = function() {
		if (!self.selectedRegion()) {
			alert("Error: no region selected.")
			return
		}
		REGION = self.selectedRegion().toLowerCase()
		self.showPanel("#teammatePanel", champWallpapers[Math.floor(Math.random() * champWallpapers.length)])
	}

	self.getStatsForPlayers = function(summonerNames) {
	
		var dfd = new jQuery.Deferred()

		$.get(constructSummonerApiUrl(summonerNames), function(data) {
			dfd.resolve(data)
		}) //GET summoner objects

		self.getBestChamps = function(summoners) {
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
								console.log("Done looking up histories.")
								var bestTeam = createTeamComp(bestChamps, [])
								self.bestTeam(_.sortBy(bestTeam.team, roleSortingValue))
								var nextBestTeam = _.sortBy(createTeamComp(bestChamps, bestTeam).team, roleSortingValue)
								console.log(JSON.stringify(nextBestTeam, null, 2))
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

		$.when(dfd).then(self.getBestChamps)

	}	

	self.buildTeam = function() {
		var summonerNames = ""
		var names = []
		for (i = 0; i < 5; i++) {
			var sn = self.summoners()[i].name
			if (sn === "") {
				console.log("Error: not all 5 summoners entered. Exiting...")
				return
			}
			if (names.indexOf(sn) >= 0) {
				console.log("Error: duplicate summoner name entered. Exiting...")
				return
			}
			if (i != 0) summonerNames += ","
			summonerNames += sn
			names.push(sn)
		}
		self.showPanel("#teamPanel", champWallpapers[Math.floor(Math.random() * champWallpapers.length)])
		self.getStatsForPlayers(summonerNames)
	}
}

$(document).ready(function() {

	ko.applyBindings(new TeamCompBuilderViewModel())

})