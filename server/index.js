const express = require('express')
const crypto = require('crypto')
const axios = require('axios')

// pay_success 云函数的公网 HTTP 触发器地址
const PAY_SUCCESS_URL = 'https://cloud1-d7gjgt9tnf380596c-1429740617.ap-shanghai.app.tcloudbase.com/pay-success'

const app = express()
const port = process.env.PORT || 3000

// 注意：微信支付回调是 XML 格式，不要用 express.json() 解析，要用 raw body
app.use(express.urlencoded({ extended: true }))

// 添加 raw body 解析中间件（专门处理微信支付回调的 XML）
app.use((req, res, next) => {
  if (req.path === '/api/pay/notify') {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      req.rawBody = data
      next()
    })
  } else {
    express.json()(req, res, next)
  }
})

const config = {
  appId: 'wxf569ca6071473954',
  mchId: '1745586320',
  apiKey: 'zvp1572438zjq1234567890987654321',
  notifyUrl: 'https://orderfood-server-259090-6-1429740617.sh.run.tcloudbase.com/api/pay/notify'
}

function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function sign(params, apiKey) {
  const sorted = Object.keys(params).filter(k => params[k] && k !== 'sign').sort()
  const signStr = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${apiKey}`
  return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase()
}

function verifySign(params, apiKey) {
  const sign = params.sign
  const sorted = Object.keys(params).filter(k => params[k] && k !== 'sign').sort()
  const signStr = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${apiKey}`
  const expectedSign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase()
  return sign === expectedSign
}

function formatXml(params) {
  let xml = '<xml>'
  for (const key in params) {
    xml += `<${key}><![CDATA[${params[key]}]]></${key}>`
  }
  xml += '</xml>'
  return xml
}

function parseXml(xml) {
  const result = {}
  const regex = /<(\w+)>(?:<!\[CDATA\[([^\]]+)\]\]>|([^<]+))<\/\1>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2] || match[3] || ''
  }
  return result
}

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.get('/api/count', (req, res) => {
  res.json({ code: 0, data: { count: 0 }, message: 'success' })
})

// 统一下单
app.post('/api/pay/unifiedorder', async (req, res) => {
  try {
    const { body: orderBody, totalFee, openid, outTradeNo } = req.body

    if (!orderBody || !totalFee || !openid) {
      return res.json({ success: false, error: '参数缺失' })
    }

    const params = {
      appid: config.appId,
      mch_id: config.mchId,
      nonce_str: generateNonceStr(),
      body: orderBody,
      out_trade_no: outTradeNo,
      total_fee: Math.round(parseFloat(totalFee) * 100),
      spbill_create_ip: '127.0.0.1',
      notify_url: config.notifyUrl,
      trade_type: 'JSAPI',
      openid: openid
    }

    params.sign = sign(params, config.apiKey)

    const https = require('https')
    const xmlData = formatXml(params)

    const request = https.request({
      hostname: 'api.mch.weixin.qq.com',
      port: 443,
      path: '/pay/unifiedorder',
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(xmlData)
      }
    }, (response) => {
      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        const result = parseXml(data)

        if (result.return_code !== 'SUCCESS') {
          return res.json({
            success: false,
            error: result.return_msg || '统一下单失败'
          })
        }

        if (result.result_code !== 'SUCCESS') {
          return res.json({
            success: false,
            error: result.err_code_des || '支付失败'
          })
        }

        const prepayId = result.prepay_id

        const paymentParams = {
          appId: config.appId,
          timeStamp: Math.floor(Date.now() / 1000).toString(),
          nonceStr: generateNonceStr(),
          package: `prepay_id=${prepayId}`,
          signType: 'MD5'
        }

        paymentParams.paySign = sign(paymentParams, config.apiKey)

        res.json({
          success: true,
          payment: paymentParams,
          outTradeNo: params.out_trade_no
        })
      })
    })

    request.on('error', (e) => {
      res.json({ success: false, error: e.message || '请求失败' })
    })

    request.write(xmlData)
    request.end()

  } catch (err) {
    res.json({ success: false, error: err.message || '服务器异常' })
  }
})

// 支付回调 - 简化版，只做基本验证，然后调用云函数处理
app.post('/api/pay/notify', async (req, res) => {
  console.log('========== 收到微信支付回调 ==========')
  
  // 1. 立即返回响应给微信（最重要，必须第一行）
  res.send(formatXml({ return_code: 'SUCCESS', return_msg: 'OK' }))
  console.log('✅ 已向微信返回成功响应')

  // 2. 后台异步处理
  try {
    const xmlData = req.rawBody
    const params = parseXml(xmlData)

    console.log('收到回调参数:', JSON.stringify(params, null, 2))

    // 3. 基本验证
    if (params.return_code !== 'SUCCESS' || params.result_code !== 'SUCCESS') {
      console.error('❌ 支付失败，跳过处理')
      return
    }

    if (!verifySign(params, config.apiKey)) {
      console.error('❌ 签名验证失败，跳过处理')
      return
    }

    const outTradeNo = params.out_trade_no
    const transactionId = params.transaction_id
    console.log('💰 支付成功，outTradeNo:', outTradeNo)

    // 4. 调用云函数的 HTTP 触发器（公网调用，避免内网不通问题）
    console.log('⏳ 开始调用 pay_success HTTP 接口...')
    try {
      const httpResult = await axios.post(PAY_SUCCESS_URL, {
        returnCode: 'SUCCESS',
        resultCode: 'SUCCESS',
        outTradeNo: outTradeNo,
        transactionId: transactionId
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      
      console.log('✅ HTTP 调用成功:', JSON.stringify(httpResult.data, null, 2))
    } catch (httpErr) {
      console.error('❌ HTTP 调用失败:', httpErr.response?.data || httpErr.message)
    }

  } catch (err) {
    console.error('❌ 处理异常:', err)
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '云托管服务运行正常' })
})

app.listen(port, () => {
  console.log(`云托管服务运行在 http://localhost:${port}`)
})

module.exports = app
