// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { university, dorm } = event
    const openid = cloud.getWXContext().OPENID
    
    // 数据验证
    if (!university || !dorm) {
      return {
        success: false,
        error: '参数缺失',
        message: '请提供完整的地址信息'
      }
    }
    
    // 验证参数格式
    if (typeof university !== 'string' || typeof dorm !== 'string') {
      return {
        success: false,
        error: '参数格式错误',
        message: '地址信息格式不正确'
      }
    }
    
    // 检查用户是否存在
    const userRes = await db.collection('user').where({
      _openid: openid
    }).get()
    
    if (!userRes.data || userRes.data.length === 0) {
      return {
        success: false,
        error: '用户不存在',
        message: '用户记录不存在，请先登录'
      }
    }
    
    // 更新用户信息
    const result = await db.collection('user').where({
      _openid: openid
    }).update({
      data: {
        university: university,
        dorm: dorm,
        updateTime: db.serverDate()
      }
    })
    
    // 检查更新是否成功
    if (result.stats.updated === 0) {
      return {
        success: false,
        error: '更新失败',
        message: '地址信息更新失败，请重试'
      }
    }
    
    return {
      success: true,
      data: {
        updated: result.stats.updated,
        university: university,
        dorm: dorm
      },
      message: '地址信息更新成功'
    }
  } catch (error) {
    console.error('更新用户地址信息失败:', error)
    return {
      success: false,
      error: error.message,
      message: '系统错误，请稍后重试'
    }
  }
}