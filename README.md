# weibo-hot-search-crawler
## 一个 Node.js 练习项目
> run: `node app.js`

* 抓取新浪微博的实时热搜榜单数据
* 利用 crontab 等方式管理定时任务，并没有在代码中进行定时任务管理
* 将解析后的数据以全量替换的方式写入自己的 mysql 数据库中

> 后又增加对百度实时热点榜单的抓取