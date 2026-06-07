const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database({
  throwOnNotFound: false
})
const _ = db.command

function generatePrintContent(order, shopInfo) {
  const orderTypeText = order.orderType === 'dineIn' ? '宿舍' : '打包'
  
  let date = new Date()
  if (order.createTime) {
    if (order.createTime instanceof Date) {
      date = order.createTime
    } else if (typeof order.createTime === 'object' && order.createTime.getTime) {
      date = new Date(order.createTime.getTime())
    } else {
      date = new Date(order.createTime)
    }
  }
  
  const formatDate = (d) => {
    const beijingTime = new Date(d.getTime() + 8 * 60 * 60 * 1000)
    const pad = (n) => (n < 10 ? '0' + n : n)
    return `${beijingTime.getUTCFullYear()}-${pad(beijingTime.getUTCMonth() + 1)}-${pad(beijingTime.getUTCDate())} ${pad(beijingTime.getUTCHours())}:${pad(beijingTime.getUTCMinutes())}`
  }
  
  const getStringWidth = (str) => {
    if (!str) return 0
    let width = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(i)
      if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) {
        width += 2
      } else {
        width += 1
      }
    }
    return width
  }
  
  const generateSpaces = (count) => {
    return ' '.repeat(count)
  }
  
  const escapeHtml = (str) => {
    if (!str) return ''
    return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  
  const hidePhoneNumber = (phone) => {
    if (!phone) return ''
    const phoneStr = String(phone)
    if (phoneStr.length === 11) {
      return phoneStr.substring(0, 3) + '****' + phoneStr.substring(7)
    }
    return phoneStr
  }
  
  let content = '<C></C><BR>'.repeat(16)
  content += `<C><font# bolder=1 height=2 width=2>${orderTypeText}订单</font#></C><BR>`
  content += `<C><font# bolder=1 height=2 width=2>${escapeHtml(shopInfo?.name || '餐饮店')}</font#></C><BR>`
  content += '<BR>'
  content += '<C>********************************</C><BR>'
  content += `<LEFT>订单编号: ${escapeHtml(order._id)}</LEFT><BR>`
  content += `<LEFT>下单时间: ${formatDate(date)}</LEFT><BR>`
  
  if (order.tableNumber) {
    content += `<C><font# bolder=1 height=2 width=2>桌码: ${escapeHtml(order.tableNumber)}</font#></C><BR>`
  }
  
  content += '<C>--------------商品--------------</C><BR>'
  
  if (order.goods && order.goods.length > 0) {
    order.goods.forEach(item => {
      const dishName = escapeHtml(item.dishName || item.goodsName || '未知菜品')
      const count = item.count || 1
      const price = parseFloat(item.price || 0).toFixed(2)
      const rightPart = `×${count}  ￥${price}`
      const dishNameWidth = getStringWidth(dishName)
      const rightPartWidth = getStringWidth(rightPart)
      const totalWidth = 31
      const spacesNeeded = totalWidth - dishNameWidth - rightPartWidth
      const spaces = spacesNeeded > 0 ? generateSpaces(spacesNeeded) : ' '
      content += `<LEFT><font# bolder=0 height=2 width=1>${dishName}${spaces}${rightPart}</font#></LEFT><BR>`
      
      if (item.tags && Array.isArray(item.tags) && item.tags.length > 0) {
        const tagsText = item.tags.map(tag => escapeHtml(tag)).join(' ')
        content += `<LEFT><font# bolder=0 height=2 width=1>  ${tagsText}</font#></LEFT><BR>`
      }
    })
  }
  
  const finalPrice = (order.finalPrice || 0).toFixed(2)
  
  content += '<C>--------------------------------</C><BR>'
  content += `<RIGHT><font# bolder=0 height=2 width=1>实付  ￥${finalPrice}</font#></RIGHT><BR>`
  
  let payMethodText = ''
  if (order.useMiandan) {
    payMethodText = '免单支付'
  } else if (order.pay_status) {
    payMethodText = '微信支付'
  } else {
    payMethodText = '余额支付'
  }
  if (payMethodText) {
    content += `<LEFT>支付方式: ${payMethodText}</LEFT><BR>`
  }
  
  content += '<C>--------------------------------</C><BR>'
  if (order.userPhone) {
    const hiddenPhone = hidePhoneNumber(order.userPhone)
    content += `<LEFT><font# bolder=1 height=1 width=1>客户电话: ${escapeHtml(hiddenPhone)}</font#></LEFT><BR>`
  }
  
  content += `<C>**************<font# bolder=1 height=2 width=1>完</font#><font# bolder=0 height=1 width=1>**************</font#></C><BR>`
  content += '<C></C><BR>'.repeat(17)
  
  return content
}

async function printOrderAsync(orderId, orderData) {
  try {
    const printerRes = await db.collection('printer').limit(1).get()
    if (!printerRes.data || printerRes.data.length === 0) {
      console.log('未绑定打印机，跳过打印')
      return
    }
    
    const printer = printerRes.data[0]
    const shopRes = await db.collection('shopInfo').limit(1).get()
    const shopInfo = shopRes.data && shopRes.data.length > 0 ? shopRes.data[0] : null
    
    const printContent = generatePrintContent(orderData, shopInfo)
    const voice = orderData.orderType === 'dineIn' ? '16' : '19'
    
    const printRes = await cloud.callFunction({
      name: 'printManage',
      data: {
        $url: 'printNote',
        sn: printer.sn,
        voice: voice,
        voicePlayTimes: 1,
        voicePlayInterval: 3,
        content: printContent,
        copies: 1,
        expiresInSeconds: 7200,
        outTradeNo: orderId
      }
    })
    
    if (printRes.result && printRes.result.success) {
      console.log('打印订单成功', printRes.result)
    } else {
      console.error('打印订单失败', printRes.result)
    }
  } catch (err) {
    console.error('打印订单异常', err)
  }
}

exports.main = async (event, context) => {
  console.log('💰 pay_success 接收到的完整 event:', JSON.stringify(event, null, 2))
  
  // 兼容两种调用方式：HTTP 触发器(event.body) 和 callFunction(event)
  let data = event.body || event
  
  // 如果是字符串（可能是 JSON 字符串），尝试解析
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {
      console.error('❌ 解析 JSON 失败:', e)
    }
  }
  
  console.log('✅ 最终使用的 data:', JSON.stringify(data, null, 2))
  
  const { returnCode, returnMsg, resultCode, errCodeDes, outTradeNo, transactionId } = data

  if (returnCode !== 'SUCCESS') {
    console.error('支付回调失败:', returnMsg)
    return { errcode: 1, errmsg: returnMsg || '支付未成功' }
  }

  if (resultCode !== 'SUCCESS') {
    console.error('支付业务失败:', errCodeDes)
    return { errcode: 1, errmsg: errCodeDes || '支付失败' }
  }

  if (!outTradeNo) {
    console.error('订单号为空')
    return { errcode: 1, errmsg: '订单号为空' }
  }

  try {
    // 1. 先通过 outTradeNo 查询订单，如果找不到再试 _id
    console.log('⏳ 正在查找订单，outTradeNo:', outTradeNo)
    let orderQuery = await db.collection('order')
      .where({
        outTradeNo: outTradeNo
      })
      .limit(1)
      .get()

    // 如果通过 outTradeNo 找不到，试试用 _id 查找
    if (!orderQuery.data || orderQuery.data.length === 0) {
      console.log('⚠️ 通过 outTradeNo 未找到订单，尝试通过 _id 查找')
      orderQuery = await db.collection('order')
        .where({
          _id: outTradeNo
        })
        .limit(1)
        .get()
    }

    if (!orderQuery.data || orderQuery.data.length === 0) {
      console.error('❌ 未找到订单，outTradeNo/_id:', outTradeNo)
      return { errcode: 1, errmsg: '未找到订单' }
    }

    const order = orderQuery.data[0]
    const orderId = order._id
    console.log('✅ 找到订单:', orderId)

    // 2. 幂等性检查
    if (order.pay_status) {
      console.log('ℹ️ 订单已支付，跳过重复处理')
      return { errcode: 0, errmsg: '订单已支付', alreadyPaid: true }
    }

    // 3. 更新订单状态
    console.log('⏳ 正在更新订单状态...')
    await db.collection('order').doc(orderId).update({
      data: {
        pay_status: true,
        status: 1,
        transactionId: transactionId,
        payTime: db.serverDate()
      }
    })
    console.log('✅ 订单状态已更新')

    // 4. 处理打印（仅普通订单）
    if (!order.type || order.type === 'order') {
      printOrderAsync(orderId, order).catch(err => {
        console.error('打印订单失败', err)
      })
    }

    // 5. 处理充值订单
    if (order.type === 'recharge') {
      const openid = order._openid
      const totalGet = order.totalGet || (order.amount + (order.giveAmount || 0))

      // 更新用户余额
      const userRes = await db.collection('user').where({
        _openid: openid
      }).get()

      if (userRes.data && userRes.data.length > 0) {
        await db.collection('user').doc(userRes.data[0]._id).update({
          data: { balance: _.inc(totalGet) }
        })
        console.log('✅ 用户余额已更新')
      }

      // 首充赠送免单
      const paidRechargeCount = await db.collection('order')
        .where({
          _openid: openid,
          type: 'recharge',
          pay_status: true
        })
        .count()

      if (paidRechargeCount.total === 1 && order.amount > 68) {
        const freeBuyRes = await db.collection('freeBuy')
          .where({ _openid: openid })
          .limit(1)
          .get()

        if (freeBuyRes.data.length > 0) {
          await db.collection('freeBuy').doc(freeBuyRes.data[0]._id).update({
            data: { count: _.inc(1) }
          })
        } else {
          await db.collection('freeBuy').add({
            data: { _openid: openid, count: 1 }
          })
        }
        console.log('✅ 首充赠送免单成功')
      }
    }

    console.log('🎉 支付回调处理完成，orderId:', orderId)
    return { errcode: 0, errmsg: '支付成功', orderId: orderId }

  } catch (e) {
    console.error('❌ 支付回调处理失败', e)
    return {
      errcode: 1,
      errmsg: '服务器异常'
    }
  }
}