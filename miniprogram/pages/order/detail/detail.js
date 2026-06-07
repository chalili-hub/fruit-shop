const db = wx.cloud.database()

Page({
  data: {
    order: {}
  },

  onLoad(options) {
    const orderId = options.id
    if (!orderId) {
      wx.showToast({
        title: '订单ID不能为空',
        icon: 'none'
      })
      return
    }
    this.loadOrder(orderId)
  },

  async loadOrder(orderId) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await db.collection('order').doc(orderId).get()
      
      if (res.data) {
        this.setData({
          order: res.data
        })
      } else {
        wx.showToast({
          title: '订单不存在',
          icon: 'none'
        })
      }
    } catch (err) {
      console.error('加载订单失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  formatTime(date) {
    if (!date) return '未知'
    
    let d
    if (typeof date === 'object' && date.seconds) {
      d = new Date(date.seconds * 1000)
    } else if (date instanceof Date) {
      d = date
    } else {
      d = new Date(date)
    }
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})