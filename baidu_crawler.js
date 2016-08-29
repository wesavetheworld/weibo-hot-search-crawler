'use strict';

const request = require('request');
const cheerio = require('cheerio');
const mysql = require('mysql');
const encoding = require('encoding');
const fs = require('fs');
const baiduUrl = 'http://top.baidu.com/buzz?b=1&fr=topbuzz_b11_c513';

const createTableStr = `CREATE TABLE IF NOT EXISTS t_baidu_hot_search_tmp (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rank int(11) NOT NULL,
  word varchar(255) NOT NULL,
  star_num int(11) DEFAULT '0',
  update_time timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=MyISAM DEFAULT CHARSET=utf8`;

const dropAndRenameTableStr = `DROP TABLE IF EXISTS t_baidu_hot_search; RENAME TABLE t_baidu_hot_search_tmp TO t_baidu_hot_search;`;

var crawlOpt = {
	uri: baiduUrl,
	method: 'GET',
	encoding: null
	// gzip: true
};

module.exports = () => {
	request(crawlOpt, (error, response, body) => {
		if (error) {
			return console.log('crawl baidu error: ' + error);
		}
		var resultBuf = encoding.convert(body, 'utf8', 'gb2312');
		var html = resultBuf.toString();
		
		parseHotDataDiv(html);
	});
}


function parseHotDataDiv(data) {
	if (data === '') {
		return console.log('div data is empty.');
	}
	var rankArr = [];
	var $ = cheerio.load(data);
	var allTr = $('.list-table tr').not('.item-tr');
	for (var i = 1; i < allTr.length; i++) {
		let rank = $('.first span', allTr[i]).text();
		let word = $('.keyword .list-title', allTr[i]).text();
		let star_num = $('.last span', allTr[i]).text();
		let item = {
			"rank": rank,
			"word": word,
			"star_num": star_num
		};
		rankArr.push(item);

	}
	writeDB(rankArr);
	// 同时将数据写一份到本地文件，做个备份
	fs.writeFileSync('baidu_out.txt', JSON.stringify(rankArr));
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
			sql += mysql.format('insert into t_baidu_hot_search_tmp set ?;', data[i]);
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