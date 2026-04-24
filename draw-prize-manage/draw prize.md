flowchart TD
    subgraph B端活动配置
        A[1. 创建活动] --> B[填写基本信息<br>名称/时间/开奖时间]
        B --> C[配置参与次数限制<br>每天1次 / 总共1次 / 无限制 / 自定义]
        C --> D[配置参与任务<br>分享 / 下单 / 积分兑换...]
        D --> E[配置奖品<br>实物 / 积分 / 优惠券 / 谢谢参与]
        E --> F[设置人工干预中奖率<br>0-100% + 是否允许一人多中]
        F --> G[保存并发布活动]
    end

    subgraph 页面装修配置
        H[进入页面装修] --> I[拖入「定时开奖」组件]
        I --> J[选择已发布的活动]
        J --> K[基础设置<br>标题 / 副标题 / 按钮文案 / 显示样式]
        K --> L[高级设置<br>按钮颜色 / 组件高度 / 仅登录可见]
        L --> M[实时预览组件效果]
        M --> N[保存 → 发布页面]
    end

    subgraph C端用户呈现
        O[用户打开活动页] --> P[展示定时开奖组件<br>标题 + 奖品墙 + 参与人数 + 双倒计时]
        P --> Q{是否已登录?}
        Q -->|否| R[引导登录/授权]
        Q -->|是| S[点击「立即参与抽奖」]
        S --> T[完成配置的任务<br>分享 / 下单 / 积分兑换]
        T --> U[获得抽奖码<br>弹窗展示 + 记录到我的抽奖]
        U --> V[等待开奖]
        V --> W[开奖时刻统一开奖]
        W --> X[显示开奖结果]
        X --> Y{是否中奖?}
        Y -->|中奖| Z[跳转领取页<br>实物填地址 / 虚拟码 / 红包]
        Y -->|未中奖| AA[谢谢参与页<br>送积分/优惠券 + 再抽一次]
        Z --> AB[领取成功]
        AA --> AC[分享给朋友 / 返回首页]
    end

    G --> H
    N --> O
    AB --> AC
    AC --> O

    classDef bEnd fill:#e6f7ff,stroke:#1890ff
    classDef decorate fill:#fff7e6,stroke:#faad14
    classDef cEnd fill:#f6ffed,stroke:#52c41a

    class A,B,C,D,E,F,G bEnd
    class H,I,J,K,L,M,N decorate
    class O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC cEnd