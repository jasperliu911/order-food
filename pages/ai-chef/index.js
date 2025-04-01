const WXAPI = require('apifm-wxapi');
const app = getApp();
Page({
  data: {
    messages: [],
    inputText: '',
    scrollTop: 0,
    defaultMeaasge: [
      {
        role: 'system',
        content: '你是一个美食助手，擅长提供美食相关的建议和建议。'
      },
      {
        role:'system',
        content: '你可以回答各种美食相关的问题，包括食谱、烹饪技巧、食材等。'
      },
      {
        role:'system',
        content: '你可以提供一些简单的食谱，让用户可以根据自己的口味和喜好来选择。'
      },
    ],
    baseInfo: '',
    showQuickQuestions: false,
    quickQuestions: [
      "冰箱里只有鸡蛋怎么做菜？",
      "辣子鸡丁的详细步骤",
      "适合新手的快手菜",
      "低卡减脂食谱推荐"
    ],
    isLoading: false,
    lastScrollTop: 0
  },

  // 输入监听
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  onLoad: function (options) {
    this.getUserApiInfo()
  },

  renderMarkdown(content) {
    let result = app.towxml(content,'markdown',{
			theme:'light',					// 主题，默认`light`
		});
    return result;
  },

  async getShoppingCarInfo() {
    const res = await WXAPI.shippingCarInfo(wx.getStorageSync('token'));
    if (res.code == 0) {
      this.setData({
        baseInfo: '你需要先理解以下内容:'+JSON.stringify(res.data)
      });
    }
  },

  async getUserApiInfo() {
    const res = await WXAPI.userDetail(wx.getStorageSync('token'))
    if (res.code == 0) {
      this.setData({apiUserInfoMap: res.data})
    }
  },
  
  async sendMessage() {
    if (this.data.isLoading || !this.data.inputText.trim()) return;
    
    // 添加加载状态
    this.setData({ isLoading: true });
    const question = this.data.inputText.trim();
    const timestamp = this.formatTime(new Date());
    
    // 更新消息列表
    const newMsg = { 
      role: 'user', 
      content: question,
      time: timestamp
    };
    const setMessages = 
      [
        ...this.data.defaultMeaasge,
        {
          role:'system',
          content: this.data.baseInfo
        },
        newMsg
      ];
    this.setData({
      messages: setMessages,
      inputText: '',
    });
    
    try {
      const aiResponse = await this.getAIResponse(setMessages);
      if (!aiResponse) {
        // Handle the case where aiResponse is undefined
        console.error('AI response is undefined');
        this.setData({ isLoading: false });
        wx.showToast({ title: '获取AI回复失败，请重试', icon: 'none' });
        return;
      }
      const aiMsg = {
        role: 'assistant',
        content: aiResponse,
        time: this.formatTime(new Date())
      };
      
      this.setData({
        messages: [...this.data.messages, aiMsg],
        isLoading: false
      });
      
      // 优化滚动体验
      wx.nextTick(() => {
        this.setData({ scrollTop: this.data.scrollTop + 1000 });
      });
      
      // 保存对话记录
      wx.setStorageSync('aiChefHistory', this.data.messages);
      
    } catch (error) {
      this.setData({ isLoading: false });
      wx.showToast({ title: '网络开小差了，请重试', icon: 'none' });
    }
  },
  
  // 新增时间格式化方法
  formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },
  
  // 快捷提问
  quickQuestion(e) {
    const question = e.currentTarget.dataset.question;
    this.setData({ inputText: question });
    this.sendMessage();
  },
  async getAIResponse(messages) {
    console.log(messages);
    const reqParams = {
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,  // 添加必要参数
      max_tokens: 2000
    }
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.deepseek.com/v1/chat/completions',
        method: 'POST',
        data: reqParams,
        header: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-b55e871396bc46afac2e5062c2a9b566',
          'Accept': 'application/json'
        },
        timeout: 60000,
        success: (res) => {
          console.log(res);
          
          if (res.statusCode === 200) {
            resolve(this.renderMarkdown(res.data.choices[0].message.content));
          } else {
            reject(new Error(`请求失败，状态码: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },
  // async getAIResponse1(messages) {
  //   console.log(messages);
  //   return new Promise((resolve, reject) => {
  //     wx.request({
  //       url: 'http://localhost:8080/api/query',
  //       method: 'POST',
  //       data: {
  //         message: messages,
  //       },
  //       header: { 
  //         'Content-Type': 'application/json',
  //       },
  //       timeout: 60000,
  //       success: (res) => {
  //         console.log(res);
          
  //         if (res.statusCode === 200) {
  //           resolve(res.data.answer);
  //         } else {
  //           reject(new Error(`请求失败，状态码: ${res.statusCode}`));
  //         }
  //       },
  //       fail: (err) => {
  //         reject(err);
  //       }
  //     });
  //   });
  // },
  // 新增长按复制方法
  copyMessage(e) {
    const content = e.currentTarget.dataset.content;
    wx.setClipboardData({
      data: content,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success',
          duration: 2000
        });
      }
    });
  },
  // 简单的 Markdown 解析函数
  parseMarkdown(markdown) {
    // 简单替换加粗语法
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<text style="font-weight: bold;">$1</text>');
    // 简单替换斜体语法
    markdown = markdown.replace(/\*(.*?)\*/g, '<text style="font-style: italic;">$1</text>');
    return markdown;
  },
})