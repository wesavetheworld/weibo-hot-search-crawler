'use strict';

const request = require('request');
const cheerio = require('cheerio');
const mysql = require('mysql');
const fs = require('fs');
const weiboUrl = 'http://s.weibo.com/top/summary?cate=realtimehot';
const urlPre = 'http://s.weibo.com';

const createTableStr = `CREATE TABLE IF NOT EXISTS t_weibo_hot_search_tmp (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rank int(11) NOT NULL,
  word varchar(255) NOT NULL,
  url varchar(2048) NOT NULL,
  info varchar(128) DEFAULT NULL,
  star_num int(11) DEFAULT '0',
  search_degree int(11) DEFAULT '0',
  update_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8`;

const dropAndRenameTableStr = `DROP TABLE IF EXISTS t_weibo_hot_search; RENAME TABLE t_weibo_hot_search_tmp TO t_weibo_hot_search;`;

var crawlOpt = {
	uri: weiboUrl,
	method: 'GET',
	gzip: true
};

request(crawlOpt, (error, response, body) => {
	if (error) {
		return console.log('crawl weibo error: ' + error);
	}
	var hotDataDiv = getHotDataDiv(body);
	// console.log('hotDataDiv: ' + hotDataDiv);
	parseHotDataDiv(hotDataDiv);
});

// weibo 实时热搜榜的数据在 js 代码里
// <script>
// STK && STK.pageletM && STK.pageletM.view({
// 	"pid": "pl_top_realtimehot",
// 	"js" : [...],
// 	"css" : [...],
// 	"html" : "..."
// })
// </script>
// html 字段中即是热搜数据的 dom 结构
function getHotDataDiv(body) {
	var $ = cheerio.load(body);
	var allScriptTag = $('script');
	for (var i = 0; i < allScriptTag.length; i++) {
		var text = $(allScriptTag[i]).text();
		// console.log('script text: ' + text);
		var pos = text.indexOf('"pid":"pl_top_realtimehot"');
		if (pos >= 0) {
			var jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
			var json = JSON.parse(jsonStr);
			return json.html;
		}

	}
	return '';
}

function parseHotDataDiv(data) {
	if (data === '') {
		return console.log('div data is empty.');
	}
	var rankArr = [];
	var $ = cheerio.load(data);
	var allTr = $('.hot_ranklist .star_bank_table tr').not('.thead_tr');
	for (var i = 0; i < allTr.length; i++) {
		let rank = $('.td_01 span em', allTr[i]).text();
		let word = $('.td_02 div p a', allTr[i]).text();
		let url = urlPre + $('.td_02 div p a', allTr[i]).attr('href');
		let info = $('.td_02 div p i', allTr[i]).text() || '';
		let star_num = $('.td_03 p span', allTr[i]).text();
		let search_degree = $('.td_04 p span', allTr[i]).attr('style');
		search_degree = search_degree.slice(search_degree.indexOf(':') + 1, search_degree.lastIndexOf('%'));
		let item = {
			"rank": rank,
			"word": word,
			"url": url,
			"info": info,
			"star_num": star_num,
			"search_degree": search_degree
		};
		rankArr.push(item);

	}
	writeDB(rankArr);
	// 同时将数据写一份到本地文件，做个备份
	fs.writeFileSync('out.txt', JSON.stringify(rankArr));
}


function writeDB(data) {
	var connection = mysql.createConnection({
		host: 'localhost',
		port: '3306',
		user: 'shel',
		password: 'shel',
		database: 'db_mtt_smartbox',
		multipleStatements: true
	});
	connection.connect((error) => {
		if (error) {
			return console.log('connect DB error: ' + error);
		}
	});

	connection.query(createTableStr, (error, results, fields) => {
		if (error) {
			return console.log('create table error: ' + error);
		}
		var sql = '';
		for (var i = 0; i < data.length; i++) {
			sql += mysql.format('insert into t_weibo_hot_search_tmp set ?;', data[i]);
		}
		// console.log('sql:' + sql);
		connection.query(sql, (err, result) => {
			if (err) {
				return console.log('insert into DB error: ' + err);
			}
			connection.query(dropAndRenameTableStr, (error, results, fields) => {
				if (error) {
					return console.log('drop and rename table error: ' + error);
				}

				connection.end();
			});
		});


	});

	// connection.end();

}