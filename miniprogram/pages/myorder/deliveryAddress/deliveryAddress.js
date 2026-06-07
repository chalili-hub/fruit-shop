// pages/myorder/deliveryAddress/deliveryAddress.js
const app = getApp()
const db = wx.cloud.database()
Page({
  data: {
    addressInfo: {
      university: '',
      dorm: ''
    },
    loading: false
  },

  onLoad() {
    this.loadAddressInfo()
  },

  onShow() {
    this.loadAddressInfo()
  },

  // 加载地址信息
  async loadAddressInfo() {
    try {
      this.setData({ loading: true })
      
      // 先从本地存储加载
      let addressInfo = wx.getStorageSync('addressInfo') || {}
      
      // 然后从云数据库加载最新信息
      const openid = app.globalData.openid
      if (openid) {
        const res = await db.collection('user').where({
          _openid: openid
        }).get()
        
        if (res.data && res.data.length > 0) {
          const user = res.data[0]
          if (user.university && user.dorm) {
            addressInfo = {
              university: user.university,
              dorm: user.dorm
            }
            // 更新本地存储
            wx.setStorageSync('addressInfo', addressInfo)
          }
        }
      }
      
      this.setData({
        addressInfo: addressInfo
      })
    } catch (err) {
      console.error('加载地址信息失败', err)
      // 加载失败时使用本地存储的信息
      const addressInfo = wx.getStorageSync('addressInfo') || {}
      this.setData({
        addressInfo: addressInfo
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 跳转到地址登记页面
  goToAddressRegister() {
    wx.navigateTo({
      url: '/pages/myhome/address/address'
    })
  }
})