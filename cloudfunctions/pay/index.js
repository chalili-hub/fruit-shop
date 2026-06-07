const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-d7gjgt9tnf380596c'
})

exports.main = async (event, context) => {
  const { body, outTradeNo, totalFee, nonceStr } = event

  try {
    const res = await cloud.cloudPay.unifiedOrder({
      body: body,
      outTradeNo: outTradeNo,
      spbillCreateIp: '127.0.0.1',
      totalFee: Math.round(parseFloat(totalFee) * 100),
      envId: 'cloud1-d7gjgt9tnf380596c',
      functionName: 'pay_success',
      nonceStr: nonceStr,
      tradeType: 'JSAPI'
    })

    console.log('统一下单结果:', res)

    if (res.returnCode !== 'SUCCESS') {
      return {
        success: false,
        error: res.returnMsg || '统一下单失败'
      }
    }

    if (res.resultCode !== 'SUCCESS') {
      return {
        success: false,
        error: res.errCodeDes || res.errMsg || '支付失败'
      }
    }

    if (!res.payment) {
      return {
        success: false,
        error: '未获取到支付参数'
      }
    }

    return {
      success: true,
      payment: res.payment
    }

  } catch (err) {
    console.error('支付云函数异常:', err)
    return {
      success: false,
      error: err.message || '服务器异常'
    }
  }
}