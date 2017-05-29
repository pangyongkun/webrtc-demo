'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var https = require('https');
var http= require('http');
var fs = require('fs');

http.createServer(function(request, response){

  var host='127.0.0.1';//进行重定向时把它换成公网ip就可以从http协议跳到https协议

  response.writeHead(301,{
     'Location':'https:127.0.0.1'+request.url
  });

  
  response.end('000');
}).listen(80);

var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();

var options = {
  key: fs.readFileSync('fakekeys/privatekey.pem'),
  cert: fs.readFileSync('fakekeys/certificate.pem')
};
var app = https.createServer(options,function(req, res) {

  fileServer.serve(req, res);
}).listen(443);



var io = socketIO.listen(app);

io.sockets.on('connection', function(socket) {

  // 发送消息的方法
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  //接收客户端发过来的消息
  socket.on('message', function(message) {
    log('Client said: ', message);
    
    //广播消息，说实话，这是不好的操作，这一步是全局广播，所有房间都会收到消息
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', function(room) {

    io.sockets.in(room).clients(function(error, clients){

      log('Received request to create or join room ' + room);

      var numClients = clients.length;
      log('Room ' + room + ' now has ' + numClients + ' client(s)');

      if (numClients === 0) {
        socket.join(room);
        log('Client ID ' + socket.id + ' created room ' + room);
        socket.emit('created', room, socket.id);

      } else if (numClients === 1) {//这里我把房间设置为默认只能允许两个人
        log('Client ID ' + socket.id + ' joined room ' + room);
        io.sockets.in(room).emit('join', room);
        socket.join(room);
        socket.emit('joined', room, socket.id);
        io.sockets.in(room).emit('ready');
      } else { // 最大用户数
        socket.emit('full', room);
      }

    })
    
  });

  //获取ip地址
  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});