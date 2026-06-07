// pages/myhome/myhome.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    userInfo: null, // 用户信息
    miandanCount: 0, // 免单次数
    showAuthModal: false, // 显示授权弹窗
    // 邀请码相关
      inviteCode: '', // 用户的邀请码
      inviteCount: 0, // 已邀请人数
      showInviteModal: false, // 邀请码弹窗
      inputInviteCode: '', // 手动输入的邀请码
      hasInvited: false, // 是否已绑定邀请关系
    // 管理员相关
    clickCount: 0, // 连续点击次数
    clickTimer: null, // 点击计时器
    showPasswordModal: false, // 显示密码输入框
    adminPassword: '', // 管理员密码
    isFirstTime: false, // 是否首次登录
    version: '', // 版本号
    // 密码错误限制
    passwordErrorCount: 0, // 密码错误次数
    passwordErrorTime: 0, // 密码错误时间戳
    isLocked: false, // 是否被锁定
    lockEndTime: 0 // 锁定结束时间
  },

  onLoad() {
    this.loadUserInfo()
    this.loadMiandanCount()
    this.getVersion()
  },

  onShow() {
    this.loadUserInfo()
    this.loadMiandanCount()
    this.loadInviteInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        // 初始化余额字段
        if (typeof user.balance === 'undefined') {
          await db.collection('user').doc(user._id).update({
            data: {
              balance: 0
            }
          })
          user.balance = 0
        }

        this.setData({
          userInfo: user
        })
        
        // 同时更新全局数据，确保其他页面也能获取最新信息
        app.globalData.userInfo = user
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    }
  },

  // 加载免单次数
  async loadMiandanCount() {
    try {
      const openid = app.globalData.openid
      const res = await db.collection('freeBuy').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        this.setData({
          miandanCount: res.data[0].count || 0
        })
      }
    } catch (err) {
      console.error('获取免单次数失败', err)
    }
  },

  // 加载邀请码信息
  async loadInviteInfo() {
    try {
      const openid = app.globalData.openid
      const res = await db.collection('user').where({
        _openid: openid
      }).get()
      
      if (res.data && res.data.length > 0) {
        const user = res.data[0]
        this.setData({
          inviteCode: user.inviteCode || '',
          inviteCount: user.inviteCount || 0,
          hasInvited: !!user.invitedBy // 是否已经被邀请过
        })
      }
    } catch (err) {
      console.error('获取邀请码信息失败', err)
    }
  },

  // 生成专属邀请码
  async generateInviteCode() {
    // 先检查是否登录
    if (!app.globalData.openid || !this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    if (this.data.inviteCode) {
      // 已有邀请码，直接显示
      this.setData({
        showInviteModal: true
      })
      return
    }

    try {
      wx.showLoading({ title: '生成邀请码中...' })

      // 生成7位数字邀请码
      const inviteCode = this.generateRandomCode()

      // 检查邀请码是否已存在
      const checkRes = await db.collection('user').where({
        inviteCode: inviteCode
      }).get()

      if (checkRes.data && checkRes.data.length > 0) {
        // 邀请码已存在，重新生成
        return this.generateInviteCode()
      }

      // 更新用户信息
      const openid = app.globalData.openid
      await db.collection('user').where({
        _openid: openid
      }).update({
        data: {
          inviteCode: inviteCode,
          inviteCount: 0
        }
      })

      wx.hideLoading()
      wx.showToast({
        title: '邀请码生成成功',
        icon: 'success'
      })

      // 更新页面数据
      this.setData({
        inviteCode: inviteCode,
        inviteCount: 0
      })

      // 更新全局用户信息
      if (app.globalData.userInfo) {
        app.globalData.userInfo.inviteCode = inviteCode
        app.globalData.userInfo.inviteCount = 0
      }

      this.setData({
        showInviteModal: true
      })
    } catch (err) {
      wx.hideLoading()
      console.error('生成邀请码失败', err)
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      })
    }
  },

  // 生成7位随机数字邀请码
  generateRandomCode() {
    let code = ''
    for (let i = 0; i < 7; i++) {
      code += Math.floor(Math.random() * 10).toString()
    }
    return code
  },

  // 显示邀请码弹窗
  async showInviteModal() {
    // 检查用户是否已登录
    if (!this.checkLogin()) {
      return
    }

    // 检查用户信息是否完整（头像和昵称）
    if (!this.checkUserInfoComplete()) {
      return
    }

    this.generateInviteCode()
  },

  // 检查登录状态
  checkLogin() {
    const openid = app.globalData.openid
    const userInfo = this.data.userInfo

    if (!openid || !userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return false
    }

    return true
  },

  // 检查用户信息是否完整（头像和昵称）
  checkUserInfoComplete() {
    const userInfo = this.data.userInfo
    const hasValidAvatar = this.isValidString(userInfo?.avatarUrl)
    const hasValidNickName = this.isValidString(userInfo?.nickName)
    
    if (!hasValidAvatar || !hasValidNickName) {
      this.setData({
        showAuthModal: true
      })
      return false
    }
    
    return true
  },

  // 判断字符串是否有效（非空、非空白、非undefined、非null）
  isValidString(str) {
    if (str === undefined || str === null) {
      return false
    }
    const trimmed = String(str).trim()
    return trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null'
  },

  // 关闭邀请码弹窗
  closeInviteModal() {
    this.setData({
      showInviteModal: false
    })
  },

  // 复制邀请码
  async copyInviteCode() {
    const inviteCode = this.data.inviteCode
    if (!inviteCode) return

    try {
      await wx.setClipboardData({
        data: inviteCode
      })
      wx.showToast({
        title: '已复制到剪贴板',
        icon: 'success'
      })
    } catch (err) {
      console.error('复制失败', err)
      wx.showToast({
        title: '复制失败',
        icon: 'none'
      })
    }
  },

  // 输入邀请码
  onInputInviteCode(e) {
    // 只允许输入数字
    const value = e.detail.value.replace(/[^\d]/g, '')
    this.setData({
      inputInviteCode: value
    })
  },

  // 提交邀请码
  async submitInviteCode() {
    const inputCode = this.data.inputInviteCode.trim()
    const currentUserOpenid = app.globalData.openid
    
    if (!inputCode) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'none'
      })
      return
    }

    if (inputCode.length !== 7) {
      wx.showToast({
        title: '邀请码必须是7位数字',
        icon: 'none'
      })
      return
    }

    if (!currentUserOpenid || !this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    // 检查是否已经被邀请过
    if (this.data.userInfo.invitedBy) {
      wx.showToast({
        title: '您已经绑定过邀请关系',
        icon: 'none'
      })
      return
    }

    if (inputCode === this.data.inviteCode) {
      wx.showToast({
        title: '不能输入自己的邀请码',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '验证中...' })

      // 查询邀请码对应的用户（邀请人）
      let inviterOpenid = ''
      const userRes = await db.collection('user').where({
        inviteCode: inputCode
      }).get()

      if (userRes.data && userRes.data.length > 0) {
        inviterOpenid = userRes.data[0]._openid
        
        // 检查是否是相互邀请（防止A邀请B后，B再邀请A）
        if (userRes.data[0].invitedBy === currentUserOpenid) {
          wx.hideLoading()
          wx.showToast({
            title: '不能邀请已邀请您的人',
            icon: 'none'
          })
          return
        }
      } else {
        // 如果用户邀请码不存在，再查询 tableCode 集合（管理员创建的邀请码）
        const tableCodeRes = await db.collection('tableCode').where({
          inviteCode: inputCode
        }).get()

        if (tableCodeRes.data && tableCodeRes.data.length > 0) {
          inviterOpenid = tableCodeRes.data[0].creatorOpenid || ''
        }
      }

      if (!inviterOpenid) {
        wx.hideLoading()
        wx.showToast({
          title: '邀请码不存在',
          icon: 'none'
        })
        return
      }

      // 更新当前用户（被邀请人）的邀请关系
      await db.collection('user').where({
        _openid: currentUserOpenid
      }).update({
        data: {
          invitedBy: inviterOpenid
        }
      })

      // 更新邀请人的邀请计数
      if (inviterOpenid !== currentUserOpenid) {
        await db.collection('user').where({
          _openid: inviterOpenid
        }).update({
          data: {
            inviteCount: db.command.inc(1)
          }
        })
      }

      wx.hideLoading()
      wx.showToast({
        title: '绑定成功',
        icon: 'success'
      })

      // 更新页面状态
      this.setData({
        hasInvited: true,
        inputInviteCode: ''
      })

      // 更新全局用户信息
      if (app.globalData.userInfo) {
        app.globalData.userInfo.invitedBy = inviterOpenid
      }
    } catch (err) {
      wx.hideLoading()
      console.error('绑定邀请码失败', err)
      wx.showToast({
        title: '绑定失败，请重试',
        icon: 'none'
      })
    }
  },

  // 显示授权弹窗
  showAuthModal() {
    this.setData({
      showAuthModal: true
    })
  },

  // 用户信息保存成功回调
  onUserInfoSaved(e) {
    // 刷新用户信息
    this.loadUserInfo()
  },

  // 跳转到充值页面
  goToRecharge() {
    if (!this.data.userInfo ) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.switchTab({
      url: '/pages/recharge/recharge'
    })
  },

  // 跳转到订单页面
  goToOrder(e) {
    const status = e.currentTarget.dataset.status
    wx.switchTab({
      url: '/pages/myorder/myorder'
    })
  },

  // 联系客服
  // 联系客服
  contactService() {
    // 使用button的open-type="contact"功能
    // 这里可以添加额外的逻辑，比如统计点击次数等
  },

  // 管理员入口触发
  onAdminTrigger() {
    this.data.clickCount++
    
    // 清除之前的计时器
    if (this.data.clickTimer) {
      clearTimeout(this.data.clickTimer)
    }

    // 如果达到5次点击，弹出密码输入框
    if (this.data.clickCount >= 5) {
      this.data.clickCount = 0
      this.checkAdminFirstTime()
    } else {
      // 1秒内未继续点击则重置计数
      this.data.clickTimer = setTimeout(() => {
        this.data.clickCount = 0
      }, 1000)
    }
  },

  // 检查是否首次设置管理员
  async checkAdminFirstTime() {
    try {
      wx.showLoading({ title: '检查中...' })
      const res = await db.collection('admin').get()
      
      wx.hideLoading()
      this.setData({
        showPasswordModal: true,
        isFirstTime: res.data.length === 0,
        adminPassword: ''
      })
    } catch (err) {
      wx.hideLoading()
      console.error('检查管理员失败', err)
      this.setData({
        showPasswordModal: true,
        isFirstTime: true,
        adminPassword: ''
      })
    }
  },

  // 关闭密码弹窗
  closePasswordModal() {
    this.setData({
      showPasswordModal: false,
      adminPassword: ''
    })
  },

  // 空函数，用于拦截遮罩点击，防止穿透到下层
  noop() {},

  // 阻止冒泡
  stopPropagation() {},

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      adminPassword: e.detail.value
    })
  },

  // 验证密码或设置密码
  async verifyPassword() {
    const password = this.data.adminPassword.trim()
    
    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      })
      return
    }

    if (password.length < 6) {
      wx.showToast({
        title: '密码长度不能少于6位',
        icon: 'none'
      })
      return
    }

    // 检查是否被锁定
    if (this.data.isLocked) {
      const now = Date.now()
      if (now < this.data.lockEndTime) {
        const remainingTime = Math.ceil((this.data.lockEndTime - now) / 1000)
        wx.showToast({
          title: `账号已被锁定，${remainingTime}秒后可重试`,
          icon: 'none'
        })
        return
      } else {
        // 锁定时间已过，解锁
        this.setData({
          isLocked: false,
          lockEndTime: 0,
          passwordErrorCount: 0,
          passwordErrorTime: 0
        })
      }
    }

    try {
      wx.showLoading({ title: this.data.isFirstTime ? '设置中...' : '验证中...' })
      
      // 查询管理员记录（只取第一条）
      const res = await db.collection('admin').limit(1).get()
      
      if (this.data.isFirstTime) {
        // 首次设置密码
        if (res.data && res.data.length > 0) {
          // 如果已存在记录，提示管理员已存在，需要登录
          wx.hideLoading()
          wx.showToast({
            title: '管理员已存在，请登录',
            icon: 'none'
          })
          // 切换为登录模式
          this.setData({
            isFirstTime: false,
            adminPassword: ''
          })
          return
        } else {
          // 如果不存在记录，则添加新记录
          await db.collection('admin').add({
            data: {
              password: password,
              createTime: new Date(),
              updateTime: new Date()
            }
          })
          
          wx.hideLoading()
          wx.showToast({
            title: '密码设置成功',
            icon: 'success'
          })
          
          // 跳转到管理员页面
          wx.navigateTo({
            url: '/pages/admin/admin'
          })
          
          this.closePasswordModal()
        }
      } else {
        // 验证密码
        wx.hideLoading()
        
        if (res.data.length === 0) {
          wx.showToast({
            title: '管理员未设置',
            icon: 'none'
          })
          return
        }
        
        const admin = res.data[0]
        if (admin.password === password) {
          // 验证成功，重置错误计数
          this.setData({
            passwordErrorCount: 0,
            passwordErrorTime: 0
          })
          
          // 跳转到管理员页面
          wx.navigateTo({
            url: '/pages/admin/admin'
          })
          
          this.closePasswordModal()
        } else {
          // 密码错误，记录错误次数
          this.handlePasswordError()
        }
      }
    } catch (err) {
      wx.hideLoading()
      console.error('操作失败', err)
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      })
    }
  },

  // 获取版本号
  getVersion() {
    const accountInfo = wx.getAccountInfoSync()
    const version = accountInfo.miniProgram.version || '1.0.0'
    this.setData({
      version: version
    })
  },

  // 跳转到地址登记页面
  goToAddress() {
    // 检查用户信息是否完整（头像和昵称）
    if (!this.checkUserInfoComplete()) {
      return
    }

    wx.navigateTo({
      url: '/pages/myhome/address/address'
    })
  },

  // 处理密码错误
  handlePasswordError() {
    const now = Date.now()
    let errorCount = this.data.passwordErrorCount
    let errorTime = this.data.passwordErrorTime

    // 检查是否在10分钟内的错误
    if (now - errorTime > 10 * 60 * 1000) {
      // 超过10分钟，重置计数
      errorCount = 1
      errorTime = now
    } else {
      // 在10分钟内，增加计数
      errorCount++
    }

    if (errorCount >= 5) {
      // 5次错误，锁定5分钟
      const lockEndTime = now + 5 * 60 * 1000
      this.setData({
        isLocked: true,
        lockEndTime: lockEndTime,
        passwordErrorCount: errorCount,
        passwordErrorTime: errorTime
      })

      wx.showToast({
        title: '密码错误次数过多，账号已锁定5分钟',
        icon: 'none'
      })
    } else {
      // 未达到5次错误，提示剩余次数
      const remainingAttempts = 5 - errorCount
      this.setData({
        passwordErrorCount: errorCount,
        passwordErrorTime: errorTime
      })

      wx.showToast({
        title: `密码错误，还剩${remainingAttempts}次机会`,
        icon: 'none'
      })
    }
  }
})
