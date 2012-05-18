/**
 * Copyright 2012 1Verge, Inc.
 *
 * 基于表单上传和基于HTML5上传程序 
 * 可实现文件的分片存储及断点续传 
 * 支持CORS(Cross-Origin Resource Sharing),可以使用AJAX跨域文件传输及获取数据
 * 
 * 说明： 本程序只是简单介绍接口的使用方式，及上传逻辑
 * 代码本身不严谨，仅供参考
 */
 
var CLIENT_ID = "5811ca7a53b611e1";
var ACCESS_TOKEN = "6978c6660ccd0bce9b32f97333061f06";
var URI = "https://openapi.youku.com/";

(function(){
    var updateSpeedTimer = null;
    var uploadStatus = {
        loaded: 0,
        total: 0
    };
    var PORTION =  1024*1024*10;

    var uploadOptions = {
        upload_token: "",
        upload_url: "",
        api_url: URI,
        client_id: CLIENT_ID,
        access_token: ACCESS_TOKEN
    };
    
    
    // 表单形式上传视频
    var uploadFormData = function (){
        var file = $("form[name='video-upload'] input[name='FileData']")[0].files[0];
        var fileSize = file.fileSize || file.size;
        var formData = new FormData();
        formData.append("FileData",file);
        var xhr = new XMLHttpRequest();
        xhr.upload.onprogress = function(e){
            if (e.lengthComputable){
                progress(e.loaded, fileSize);
            }
        };
        xhr.onload = function(){
            var response = eval("(" + this.responseText + ")");
            if (response["upload_server_name"]) {
                success(response["upload_server_name"]);
            } else {
                alert("上传文件失败");
            }
        }
        xhr.open("post",uploadOptions["upload_url"],true);
        xhr.send(formData);
    };

    // 上传视频
    var uploadStreamData = function (start){
        var file = $("form[name='video-upload'] input[name='FileData']")[0].files[0];
        var fileSize = file.fileSize || file.size;
        var blob = null;
        var start = start || 0;
        if (file.slice){
            blob = file.slice(start,start + PORTION);
        }else if(file.webkitSlice){
            blob = file.webkitSlice(start,start + PORTION);
        }else if(file.mozSlice){
            blob = file.mozSlice(start,start + PORTION);
        }else{
            blob  = file;
            start = 0; 
        } 
        var xhr = new XMLHttpRequest();
        var ranges = "bytes " + (start + 1) + "-" + (start + blob.size) + "/" + fileSize;
        xhr.upload.onprogress = function(e){
            if (e.lengthComputable){
                progress(e.loaded + start, fileSize);
            }
        };
        xhr.onload = function(){
            try {
                var response = eval("(" + this.responseText + ")");
                if (response["code"]) {
                    alert(response["description"]);
                } else {
                    if (response["upload_server_name"]) {
                        success(response["upload_server_name"]);
                    } else {
                        var fileTransfered = response["file_transfered"];
                        if (fileTransfered != fileSize) {
                            uploadStreamData(fileTransfered);
                        }
                    }
                }
            } catch (e) {
                // throw exception
            }
        }
        xhr.open("post",uploadOptions["upload_url"],true);
        xhr.setRequestHeader("Content-Range",ranges);
        xhr.send(blob);
    };

    var startVideoUpload = function (upload_token){
        uploadOptions["upload_token"] = upload_token;

        if (window['USE_STREAM_UPLOAD']) {
            var url = "http://upload.youku.com/api/get_server_address/?" + "upload_token=" + upload_token;
            $.ajax({
                type: 'POST',
                url: url,
                crossDomain: true,
                complete: function (jqXHR, textStatus){
                    var reponseData = eval("(" + jqXHR.responseText + ")");
                    if (reponseData["server_address"]) {
                        uploadOptions["upload_url"] = "http://" + reponseData["server_address"] + "/api/upload/?" + "upload_token=" + upload_token;
                    } else {
                        uploadOptions["upload_url"] = "http://upload.youku.com/api/upload/?" + "upload_token=" + upload_token;
                    }
                    uploadStreamData();
                }
            });
        } else {
            uploadOptions["upload_url"] = "http://upload.youku.com/api/upload_form_data/?" + "upload_token=" + upload_token;
            uploadFormData();
        }
    }

    var progress = function (loaded,total){
        var percent = Math.round((loaded / total)*100) + '%';
        $("#upload-status-wraper .bar").attr("style","width:" + percent);
        uploadStatus.loaded = loaded;
        uploadStatus.total = total;
        if(updateSpeedTimer && loaded == total){
            clearTimeout(updateSpeedTimer);
        }
        if(!updateSpeedTimer){
            updateSpeedTimer = setTimeout(function(){
                updateSpeed(loaded);
            },1000)
        }
    };

    var secondsToTime = function (secs) { // we will use this function to convert seconds in normal time format
        var hr = Math.floor(secs / 3600);
        var min = Math.floor((secs - (hr * 3600))/60);
        var sec = Math.floor(secs - (hr * 3600) -  (min * 60));

        if (hr < 10) {hr = "0" + hr; }
        if (min < 10) {min = "0" + min;}
        if (sec < 10) {sec = "0" + sec;}
        return hr + ':' + min + ':' + sec;
    };

    var updateSpeed =  function(prevLoaded){
        if(updateSpeedTimer){
            clearTimeout(updateSpeedTimer);
        }
        var loaded = uploadStatus.loaded;
        var total = uploadStatus.total;
        var fileUploader = this;
        var prevLoaded = prevLoaded || 0;
        var speed = (loaded - prevLoaded) * 2;
        var time = (total - loaded) / speed;

        var tpl = "";

        if (speed > 1024*1024) {
            tpl += Math.round(speed / (1024 * 1024) * 100)/100 + ' MB/s | ';
            tpl += secondsToTime(time) + ' | ';
            tpl += Math.round(loaded / total * 10000)/100 + ' % | ';
            tpl += Math.round(loaded/ (1024 * 1024) * 100)/100 + ' MB / ' + Math.round(total/ (1024 * 1024) * 100)/100 + " MB";
        } else {
            tpl += Math.round(speed / 1024 * 100)/100 + ' KB/s | ';
            tpl += secondsToTime(time) + ' | ';
            tpl += Math.round(loaded / total * 10000)/100 + ' % | ';
            tpl += Math.round(loaded/ 1024 * 100)/100 + ' KB / ' + Math.round(total/ 1024 * 100)/100 + " KB";
        }
        $("#upload-status-wraper .progress-extended").html(tpl);
        updateSpeedTimer = setTimeout(function(){
            updateSpeed(loaded);
        },500);
    };

    var success = function (server_name){
        var params = {
            client_id: uploadOptions["client_id"],
            access_token: uploadOptions["access_token"],
            upload_token: uploadOptions["upload_token"], 
            upload_server_name: server_name
        };

        $.ajax({
            type: 'POST',
            url: uploadOptions["api_url"] + "v2/uploads/web/commit.json",
            data: params,
            complete: function (jqXHR, textStatus){
                var reponseData = eval("(" + jqXHR.responseText + ")");
                if (reponseData["video_id"]) {
                    var tpl = '<div class="alert alert-success"><h1>上传成功！</h1><br>';
                    tpl += "<p>视频正在转码中，转码完成后，您可以通过以下地址观看视频：";
                    tpl += "<br>http://v.youku.com/v_show/id_" + reponseData["video_id"] + ".html</p></div>";
                    $("#upload-status-wraper").html(tpl);
                }else {
                    $("#upload-status-wraper").html('<div class="alert alert-success"><h1>上传失败！</h1></div>');
                }
            }
        });
    };

    // 创建上传任务
    var createUploadTask = function (){
        var params = {
                title: $("form[name='video-upload'] input[name='title']").val(),
                description: $("form[name='video-upload'] textarea[name='description']").val(),
                tags: $("form[name='video-upload'] input[name='tags']").val(),
                category: $("form[name='video-upload'] select[name='category']").val(),
                copyright_type: $("form[name='video-upload'] input[name='copyright_type']:checked").val(),
                public_type: $("form[name='video-upload'] input[name='public_type']:checked").val(),
                client_id: uploadOptions["client_id"],
                access_token: uploadOptions["access_token"],
                file_name: $("form[name='video-upload'] input[name='FileData']").val()
        };
    if(params["public_type"] == "password") {
    	params["watch_password"] = $("form[name='video-upload'] input[name='watch_password']").val();
    }
        $.ajax({
            type: 'POST',
            url: uploadOptions["api_url"] + "v2/uploads/web/create.json",
            data: params,
            crossDomain: true,
            complete: function (jqXHR, textStatus){
                var reponseData = eval("(" + jqXHR.responseText + ")");
                if (reponseData["upload_token"]) {
                    var tpl = '<h1>正在上传视频</h1><p>请不要关闭浏览器，此操作造成上传失败!';
                    tpl += '<br>上传需要一段时间，请耐心等待.</p><br><div class="progress progress-success" style="margin-bottom: 9px;">';
                    tpl += '<div class="bar" style="width: 0%"></div></div><div class="progress-extended">';
                    tpl +=  '00.00 kbit/s | 00:00:00 | 00.00 % | 00.00 KB / 00.00 KB</div>';
                    $("form[name='video-upload']").hide();
                    $("#upload-status-wraper").html(tpl);
                    startVideoUpload(reponseData["upload_token"]);
                } else {
                    alert(reponseData["error"]["description"]);
                }
            }
        });
    };
    $("#btn-upload-start").click(function(event){
        event.preventDefault(); 
        createUploadTask();
    });
    $("#public_type1").click(function(event){
        $("#passwrod").hide();
    });
    $("#public_type2").click(function(event){
       $("#passwrod").hide();
    });
    $("#public_type3").click(function(event){
        $("#passwrod").show();;
    });

    // 获取视频分类
    $.ajax({
        type: 'POST',
        url: uploadOptions["api_url"] + "v2/schemas/video/category.json",
        crossDomain: true,
        complete: function (jqXHR, textStatus){
            var reponseData = eval("(" + jqXHR.responseText + ")");
            if (reponseData["categories"]) {
               var tpl = '';
               for (var i=0; i<reponseData["categories"].length; i++) {
                    tpl += '<option value="' + reponseData["categories"][i]["term"] + '" >' + reponseData["categories"][i]["label"] + '</option>'; 
               }
               $("#category-node").html(tpl);
            }
        }
    });
})();

