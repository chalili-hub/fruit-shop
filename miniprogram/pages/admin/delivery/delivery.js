// pages/admin/delivery/delivery.js
const db = wx.cloud.database()

Page({
  data: {
    deliveryServices: [],
    showAddModal: false,
    showEditModal: false,
    currentService: {
      _id: '',
      title: '',
      description: '',
      image: ''
    },
    loading: false
  },

  onLoad() {
    this.loadDeliveryServices()
  },

  // 加载配送服务列表
  async loadDeliveryServices() {
    try {
      this.setData({ loading: true })
      const res = await db.collection('deliveryService').get()
      this.setData({
        deliveryServices: res.data || [],
        loading: false
      })
    } catch (err) {
      console.error('加载配送服务失败', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 显示添加配送服务弹窗
  showAddModal() {
    this.setData({
      showAddModal: true,
      currentService: {
        _id: '',
        title: '',
        description: '',
        image: ''
      }
    })
  },

  // 显示编辑配送服务弹窗
  showEditModal(e) {
    const service = e.currentTarget.dataset.service
    this.setData({
      showEditModal: true,
      currentService: { ...service }
    })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showAddModal: false,
      showEditModal: false
    })
  },

  // 输入标题
  onTitleInput(e) {
    this.setData({
      'currentService.title': e.detail.value
    })
  },

  // 输入描述
  onDescriptionInput(e) {
    this.setData({
      'currentService.description': e.detail.value
    })
  },

  // 选择图片
  async chooseImage() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      const tempFilePath = res.tempFilePaths[0]

      wx.showLoading({ title: '上传中...' })

      const cloudPath = `delivery/${Date.now()}_${Math.random().toString(36).substr(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      })

      wx.hideLoading()

      this.setData({
        'currentService.image': uploadRes.fileID
      })

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      })
    } catch (err) {
      wx.hideLoading()
      console.error('上传图片失败', err)
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      })
    }
  },

  // 保存配送服务
  async saveDeliveryService() {
    const { title, description, image } = this.data.currentService

    if (!title.trim()) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }

    if (!description.trim()) {
      wx.showToast({ title: '请输入描述', icon: 'none' })
      return
    }

    if (!image) {
      wx.showToast({ title: '请上传图片', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      if (this.data.showEditModal) {
        // 编辑
        await db.collection('deliveryService').doc(this.data.currentService._id).update({
          data: {
            title: title.trim(),
            description: description.trim(),
            image: image
          }
        })
      } else {
        // 添加
        await db.collection('deliveryService').add({
          data: {
            title: title.trim(),
            description: description.trim(),
            image: image,
            createTime: new Date()
          }
        })
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.closeModal()
      this.loadDeliveryServices()
    } catch (err) {
      wx.hideLoading()
      console.error('保存失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 删除配送服务
  deleteDeliveryService(e) {
    const service = e.currentTarget.dataset.service

    wx.showModal({
      title: '确认删除',
      content: `确定要删除配送服务"${service.title}"吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            await db.collection('deliveryService').doc(service._id).remove()
            wx.hideLoading()
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadDeliveryServices()
          } catch (err) {
            wx.hideLoading()
            console.error('删除失败', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    
    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  // 阻止冒泡
  stopPropagation() {}
})