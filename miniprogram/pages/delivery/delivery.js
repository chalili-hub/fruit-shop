// pages/delivery/delivery.js
const db = wx.cloud.database()

Page({
  data: {
    deliveryServices: []
  },

  onLoad() {
    this.loadDeliveryServices()
  },

  // 加载配送服务列表
  async loadDeliveryServices() {
    try {
      const res = await db.collection('deliveryService').get()
      this.setData({
        deliveryServices: res.data || []
      })
    } catch (err) {
      console.error('加载配送服务失败', err)
    }
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    
    wx.previewImage({
      current: url,
      urls: [url]
    })
  }
})