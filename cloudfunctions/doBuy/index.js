// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 生成打印内容
function generatePrintContent(order, shopInfo) {
  const orderTypeText = order.orderType === 'dineIn' ? '宿舍' : '打包'
  
  let date = new Date()
  if (order.createTime) {
    date = new Date(order.createTime)
  }
  
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
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
  
  let content = `<C>*</C><BR>`
  content += `<C></C><BR>`.repeat(16)
  content += `<C><font# bolder=1 height=2 width=2>${orderTypeText}订单</font#></C><BR>`
  content += `<C><font# bolder=1 height=2 width=2>${escapeHtml(shopInfo?.name || '大深夜水果铺')}</font#></C><BR><BR>`
  
  content += `<C>********************************</C><BR>`
  content += `<LEFT>订单编号: ${escapeHtml(order._id)}</LEFT><BR>`
  content += `<LEFT>下单时间: ${formatDate(date)}</LEFT><BR>`
  content += `<C>--------------商品--------------</C><BR>`
  
  if (order.goods && order.goods.length > 0) {
    order.goods.forEach(item => {
      const dishName = escapeHtml(item.dishName || '未知菜品')
      const count = item.count || 1
      const price = parseFloat(item.price || 0).toFixed(2)
      const rightPart = `×${count}  ￥${price}`
      const spaces = generateSpaces(Math.max(0, 31 - getStringWidth(dishName) - getStringWidth(rightPart)))
      content += `<LEFT><font# bolder=0 height=2 width=1>${dishName}${spaces}${rightPart}</font#></LEFT><BR>`
      
      if (item.tags && item.tags.length > 0) {
        content += `<LEFT>  ${escapeHtml(item.tags.join(' '))}</LEFT><BR>`
      }
    })
  }
  
  const finalPrice = (order.finalPrice || 0).toFixed(2)
  content += `<C>--------------------------------</C><BR>`
  content += `<RIGHT><font# bolder=0 height=2 width=1>实付  ￥${finalPrice}</font#></RIGHT><BR>`
  
  let payMethodText = ''
  if (order.useMiandan) {
    payMethodText = '免单支付'
  } else if (order.payWithBalance) {
    payMethodText = '余额支付'
  } else {
    payMethodText = '微信支付'
  }
  content += `<LEFT>支付方式: ${payMethodText}</LEFT><BR>`
  
  content += `<C>--------------------------------</C><BR>`
  
  if (order.userPhone) {
    content += `<LEFT>客户电话: ${hidePhoneNumber(order.userPhone)}</LEFT><BR>`
  }
  if (order.userNickName) {
    content += `<LEFT>客户昵称: ${escapeHtml(order.userNickName)}</LEFT><BR>`
  }
  if (order.university && order.dorm) {
    content += `<LEFT>配送地址: ${escapeHtml(order.university)}</LEFT><BR>`
    content += `<LEFT>具体位置: ${escapeHtml(order.dorm)}</LEFT><BR>`
  }
  
  content += `<C>**************完**************</C><BR>`
  content += `<C></C><BR>`.repeat(20)
  
  return content
}

// 打印订单
async function printOrder(orderId, orderData) {
  try {
    const printerRes = await db.collection('printer').limit(1).get()
    if (!printerRes.data || printerRes.data.length === 0) {
      console.log('未配置打印机')
      return
    }
    
    const printer = printerRes.data[0]
    const shopRes = await db.collection('shopInfo').limit(1).get()
    const shopInfo = shopRes.data && shopRes.data.length > 0 ? shopRes.data[0] : null
    
    const printContent = generatePrintContent(orderData, shopInfo)
    
    await cloud.callFunction({
      name: 'printManage',
      data: {
        $url: 'printNote',
        sn: printer.sn,
        content: printContent,
        copies: 1,
        outTradeNo: orderId,
        voice: orderData.orderType === 'dineIn' ? '16' : '19',
        voicePlayTimes: 1
      }
    })
    
    console.log('打印成功')
  } catch (error) {
    console.error('打印失败:', error)
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('=== doBuy 云函数开始执行 ===')
    console.log('event参数:', JSON.stringify(event, null, 2))
    
    const { orderGoods, totalPrice, finalPrice, useMiandan, orderType, payWithBalance } = event
    const openid = cloud.getWXContext().OPENID
    
    // ✅ 终极加固1：强制价格为数字，杜绝NaN
    const fixedTotal = Number(totalPrice) || 0
    const fixedFinal = Number(finalPrice) || 0
    
    console.log('解析后的参数:', {
      orderGoodsLength: orderGoods?.length,
      totalPrice: fixedTotal,
      finalPrice: fixedFinal,
      useMiandan,
      orderType,
      payWithBalance,
      openid: openid ? '存在' : '不存在'
    })
    
    if (!orderGoods || orderGoods.length === 0) {
      return { success: false, error: '参数错误', message: '订单商品不能为空' }
    }
    
    // 1. 获取用户信息
    const userRes = await db.collection('user').where({ _openid: openid }).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, error: '用户不存在', message: '请先登录' }
    }
    const user = userRes.data[0]
    
    // 2. 免单校验
    if (useMiandan) {
      const freeBuyRes = await db.collection('freeBuy').where({ _openid: openid }).get()
      if (!freeBuyRes.data || freeBuyRes.data[0]?.count <= 0) {
        return { success: false, error: '免单次数不足', message: '免单次数不足' }
      }
    }
    
    // 3. 余额校验
    if (payWithBalance && fixedFinal > 0) {
      if (!user.balance || user.balance < fixedFinal) {
        return { success: false, error: '余额不足', message: '余额不足' }
      }
    }
    
    // 4. 创建订单（终极净化商品数组，堵死所有非法值）
    const finalOrderType = orderType || 'takeOut'
    // 强制净化商品数据：干掉所有undefined、null、非法对象
    const cleanGoods = (orderGoods || []).map(item => ({
      dishId: item.dishId || '',
      dishName: item.dishName || '未知菜品',
      dishImage: item.dishImage || '', // 保留图片字段
      count: Number(item.count) || 1,
      price: Number(item.price) || 0,
      tags: Array.isArray(item.tags) ? item.tags : [],
      // 只保留需要的字段，多余的全删掉！
    }))

    const orderData = {
      type: 'order',
      goods: cleanGoods,
      totalPrice: fixedTotal,
      finalPrice: fixedFinal,
      useMiandan: useMiandan,
      orderType: finalOrderType,
      pay_status: !!(payWithBalance || useMiandan),
      createTime: db.serverDate(),
      _openid: openid,
      userNickName: user.nickName || '',
      userAvatar: user.avatarUrl || '',
      userPhone: user.phoneNumber || '',
      university: user.university || '',
      dorm: user.dorm || ''
    }

    const orderRes = await db.collection('order').add({
      data: orderData
    })
    const orderId = orderRes._id
    const outTradeNo = orderId

    // 更新订单添加 outTradeNo
    await db.collection('order').doc(orderId).update({
      data: { outTradeNo: outTradeNo }
    })
    
    // 扣减免单/余额
    if (useMiandan) {
      const free = await db.collection('freeBuy').where({_openid:openid}).get()
      if(free.data.length) await db.collection('freeBuy').doc(free.data[0]._id).update({data:{count:db.command.inc(-1)}})
    }
    if (payWithBalance && fixedFinal>0) {
      await db.collection('user').doc(user._id).update({data:{balance:db.command.inc(-fixedFinal)}})
    }
    
    const result = {
      success: true,
      orderId: orderId,
      outTradeNo: outTradeNo,
      order: { ...orderData, _id: orderId, payWithBalance }
    }
    
    // 打印
    if (payWithBalance || useMiandan) {
      await printOrder(orderId, result.order).catch(()=>{})
    }
    
    return result
  } catch (error) {
    console.error('下单失败:', error)
    return { success: false, error: error.message, message: '系统错误' }
  }
}