// pages/myhome/address/address.js
const app = getApp()
const db = wx.cloud.database()
Page({
  data: {
    universityOptions: ['深圳大学（粤海）'],
    universityIndex: 0,
    dormOptions: [
      '南区（女生）', '南区（男生）', '红豆斋', '聚翰斋','紫薇斋','蓬莱客舍',
      '乔木阁', '乔林阁','乔森阁', '乔相阁', '乔梧阁', '五花阁区'
      , '紫檀轩', '丹枫轩','木犀轩',  '辛夷阁', '韵竹阁'
    ],
    dormIndex: 0,
    loading: false
  },
  
  onLoad() {
    this.loadUserAddress()
  },
  
  // 加载用户现有的地址信息
  async loadUserAddress() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        if (user.university && user.dorm) {
          // 找到对应的索引
          const universityIndex = this.data.universityOptions.indexOf(user.university)
          const dormIndex = this.data.dormOptions.indexOf(user.dorm)
          
          if (universityIndex !== -1 && dormIndex !== -1) {
            this.setData({
              universityIndex: universityIndex,
              dormIndex: dormIndex
            })
          }
        }
      }
    } catch (err) {
      console.error('加载地址信息失败', err)
    } finally {
      wx.hideLoading()
    }
  },
  
  universityChange(e) {
    this.setData({
      universityIndex: e.detail.value
    });
  },
  
  dormChange(e) {
    this.setData({
      dormIndex: e.detail.value
    });
  },
  
  async submit() {
    if (this.data.loading) return
    
    const addressInfo = {
      university: this.data.universityOptions[this.data.universityIndex],
      dorm: this.data.dormOptions[this.data.dormIndex]
    };
    
    try {
      this.setData({ loading: true })
      wx.showLoading({ title: '保存中...' })
      
      // 保存到本地存储
      wx.setStorageSync('addressInfo', addressInfo);
      
      // 发送到服务器（云开发）
      const openid = app.globalData.openid
      if (openid) {
        const res = await wx.cloud.callFunction({
          name: 'updateUser',
          data: {
            university: addressInfo.university,
            dorm: addressInfo.dorm
          }
        })
        
        if (res.result && res.result.success) {
          console.log('地址保存到服务器成功:', res.result);
          
          // 更新本地存储中的用户信息
          const userInfo = wx.getStorageSync('userInfo') || {}
          userInfo.university = addressInfo.university;
          userInfo.dorm = addressInfo.dorm;
          wx.setStorageSync('userInfo', userInfo);
          
          // 更新全局用户信息
          if (app.globalData.userInfo) {
            app.globalData.userInfo.university = addressInfo.university
            app.globalData.userInfo.dorm = addressInfo.dorm
          }
          
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 2秒后返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 2000);
        } else {
          const errorMsg = res.result?.message || '保存失败'
          wx.showToast({
            title: errorMsg,
            icon: 'none'
          });
        }
      } else {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('保存地址失败', err)
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false })
      wx.hideLoading()
    }
  }
});