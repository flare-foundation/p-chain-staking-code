curl -X POST --data '{
  "jsonrpc":"2.0",
  "id"     : 1,
  "method" :"platform.getBalance",
  "params" :{
      "address":"P-localflare18jma8ppw3nhx5r4ap8clazz0dps7rv5uj3gy4v"
  }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/bc/P 

curl -X POST --data '{
  "jsonrpc":"2.0",
  "id"     : 1,
  "method" :"evm.getBalance",
  "params" :{
      "address":"0x8db97c7cece249c2b98bdc0226cc4c2a57bf52fc"
  }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/bc/C

curl -X POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method" :"info.getNetworkID"
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/info

curl -X POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method" :"info.getBlockchainID",
    "params": {
        "alias":"C"
    }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/info